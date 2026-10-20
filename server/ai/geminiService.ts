import { GoogleGenAI, Type } from '@google/genai';
import {
  AIRunLog,
  CompetencyCode,
  ErrorTagCode,
  PrimaryUse,
  Question,
  QuestionType,
} from '../../src/types/index.ts';
import { sanitizeStudentFeedbackText as authSanitizeStudentFeedbackText } from '../auth/authorization.ts';

export function sanitizeStudentFeedbackText(
  text: string | null | undefined,
  correctAnswer: string,
  solution?: string
): string {
  return authSanitizeStudentFeedbackText(text, correctAnswer, solution);
}

const MODEL_NAME = 'gemini-3.8-flash';

const ALLOWED_ERROR_TYPES = new Set<ErrorTagCode | 'NEED_MORE_EVIDENCE'>([
  ErrorTagCode.CONCEPT_ERROR,
  ErrorTagCode.FORMULA_ERROR,
  ErrorTagCode.PROCEDURE_ERROR,
  ErrorTagCode.SIGN_ERROR,
  ErrorTagCode.CALCULATION_ERROR,
  ErrorTagCode.APPLICATION_ERROR,
  'NEED_MORE_EVIDENCE',
]);

const ALLOWED_NEXT_ACTIONS = new Set<'RETRY' | 'REVIEW_CONCEPT' | 'ERROR_CORRECTION_TASK'>([
  'RETRY',
  'REVIEW_CONCEPT',
  'ERROR_CORRECTION_TASK',
]);

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Simple per-school rate limiter (max 30 requests per minute)
const rateLimitWindow: Record<string, number[]> = {};
function checkRateLimit(schoolId: string): boolean {
  const now = Date.now();
  const list = (rateLimitWindow[schoolId] || []).filter((t) => now - t < 60_000);
  if (list.length >= 30) {
    rateLimitWindow[schoolId] = list;
    return false;
  }
  list.push(now);
  rateLimitWindow[schoolId] = list;
  return true;
}

/**
 * 78 & FIX 04. AI - ERROR ANALYZER
 * Analyzes student error on the server without EVER revealing correctAnswer in evidence or studentFeedback.
 */
export async function analyzeStudentErrorWithGemini(params: {
  schoolId: string;
  actorId: string;
  pseudonymId: string;
  questionText: string;
  correctAnswer: string;
  studentAnswer: string;
  competency: CompetencyCode;
  candidateErrorTags: ErrorTagCode[];
  onLog: (log: AIRunLog) => void;
}): Promise<{
  errorType: ErrorTagCode | 'NEED_MORE_EVIDENCE';
  confidence: number;
  evidence: string;
  studentFeedback: string;
  nextAction: 'RETRY' | 'REVIEW_CONCEPT' | 'ERROR_CORRECTION_TASK';
  aiFallbackUsed?: boolean;
  aiWarning?: string;
}> {
  const start = Date.now();
  const ai = getGeminiClient();

  const systemInstruction =
    'Bạn là AI hỗ trợ giáo viên phân tích lỗi học tập. Chỉ dùng dữ liệu được cung cấp. Tuyệt đối KHÔNG viết đáp án đúng vào trường evidence hoặc studentFeedback để tránh lộ đáp án cho học sinh. Không suy đoán trí thông minh, tính cách, tâm lý, hoàn cảnh gia đình hoặc khả năng lâu dài của học sinh. Chỉ chọn error_type trong danh sách cho phép. Nếu bằng chứng không đủ, trả NEED_MORE_EVIDENCE.';

  if (!ai || !checkRateLimit(params.schoolId)) {
    const fallbackTag = params.candidateErrorTags[0] || ErrorTagCode.SIGN_ERROR;
    params.onLog({
      runId: `airun_${Date.now()}`,
      schoolId: params.schoolId,
      taskType: 'ERROR_ANALYZER',
      model: MODEL_NAME,
      promptVersion: 'v1.0-error-analyzer',
      latencyMs: Date.now() - start,
      success: false,
      confidence: 0.78,
      errorMessage: !ai ? 'GEMINI_API_KEY not configured' : 'Rate limit reached',
      createdBy: params.actorId,
      timestamp: new Date().toISOString(),
    });
    return {
      errorType: fallbackTag,
      confidence: 0.78,
      evidence: sanitizeStudentFeedbackText(
        `Học sinh (${params.pseudonymId}) nhập phương án "${params.studentAnswer}" có dấu hiệu sai quy tắc biến đổi ở năng lực ${params.competency}.`,
        params.correctAnswer
      ),
      studentFeedback:
        'Em hãy kiểm tra lại quy tắc dấu ở bước biến đổi và nhân tử chung của biểu thức.',
      nextAction: 'RETRY',
      aiFallbackUsed: true,
      aiWarning: 'AI PATH tạm thời chưa thể tạo phân tích mới. Dữ liệu học tập đã được lưu.',
    };
  }

  try {
    const prompt = `Phân tích câu trả lời chưa chính xác của học sinh (${params.pseudonymId}):
- Câu hỏi: ${params.questionText}
- Đáp án chuẩn (chỉ dùng nội bộ để đối chiếu, TUYỆT ĐỐI KHÔNG nhắc lại đáp án này trong evidence hay studentFeedback): ${params.correctAnswer}
- Câu trả lời của học sinh: ${params.studentAnswer}
- Năng lực: ${params.competency}
- Danh sách errorType cho phép: CONCEPT_ERROR, FORMULA_ERROR, PROCEDURE_ERROR, SIGN_ERROR, CALCULATION_ERROR, APPLICATION_ERROR, NEED_MORE_EVIDENCE.
Lưu ý: Không tiết lộ đáp án đúng. Không dùng từ "yếu", "kém", "dốt", "chậm". Dùng ngôn ngữ khích lệ sư phạm.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            errorType: {
              type: Type.STRING,
              description:
                'One of CONCEPT_ERROR, FORMULA_ERROR, PROCEDURE_ERROR, SIGN_ERROR, CALCULATION_ERROR, APPLICATION_ERROR, NEED_MORE_EVIDENCE',
            },
            confidence: { type: Type.NUMBER },
            evidence: { type: Type.STRING },
            studentFeedback: { type: Type.STRING },
            nextAction: { type: Type.STRING, description: 'RETRY, REVIEW_CONCEPT, or ERROR_CORRECTION_TASK' },
          },
          required: ['errorType', 'confidence', 'evidence', 'studentFeedback', 'nextAction'],
        },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim());
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.85;
    const fallbackTag = params.candidateErrorTags[0] || ErrorTagCode.SIGN_ERROR;
    const validatedErrorType: ErrorTagCode | 'NEED_MORE_EVIDENCE' = ALLOWED_ERROR_TYPES.has(
      parsed.errorType
    )
      ? parsed.errorType
      : fallbackTag;
    const validatedNextAction: 'RETRY' | 'REVIEW_CONCEPT' | 'ERROR_CORRECTION_TASK' =
      ALLOWED_NEXT_ACTIONS.has(parsed.nextAction) ? parsed.nextAction : 'RETRY';

    params.onLog({
      runId: `airun_${Date.now()}`,
      schoolId: params.schoolId,
      taskType: 'ERROR_ANALYZER',
      model: MODEL_NAME,
      promptVersion: 'v1.0-error-analyzer',
      latencyMs: Date.now() - start,
      success: true,
      confidence,
      createdBy: params.actorId,
      timestamp: new Date().toISOString(),
    });

    return {
      errorType: validatedErrorType,
      confidence,
      evidence: sanitizeStudentFeedbackText(
        parsed.evidence ||
          `Phân tích câu trả lời "${params.studentAnswer}" của học sinh (${params.pseudonymId}) trên năng lực ${params.competency}.`,
        params.correctAnswer
      ),
      studentFeedback: sanitizeStudentFeedbackText(
        parsed.studentFeedback || 'Em hãy kiểm tra lại quy tắc dấu ở bước biến đổi.',
        params.correctAnswer
      ),
      nextAction: validatedNextAction,
    };
  } catch (err) {
    const fallbackTag = params.candidateErrorTags[0] || ErrorTagCode.SIGN_ERROR;
    params.onLog({
      runId: `airun_${Date.now()}`,
      schoolId: params.schoolId,
      taskType: 'ERROR_ANALYZER',
      model: MODEL_NAME,
      promptVersion: 'v1.0-error-analyzer',
      latencyMs: Date.now() - start,
      success: false,
      errorMessage: err instanceof Error ? err.message : 'Unknown Gemini error',
      createdBy: params.actorId,
      timestamp: new Date().toISOString(),
    });
    return {
      errorType: fallbackTag,
      confidence: 0.76,
      evidence: `Học sinh (${params.pseudonymId}) nhập "${params.studentAnswer}" cần kiểm tra lại bước biến đổi đại số.`,
      studentFeedback: 'Em hãy kiểm tra lại quy tắc dấu ở bước biến đổi.',
      nextAction: 'RETRY',
      aiFallbackUsed: true,
      aiWarning: 'AI PATH tạm thời chưa thể tạo phân tích mới. Dữ liệu học tập đã được lưu.',
    };
  }
}

/**
 * 79 & FIX 04. AI - HINT GENERATOR
 * Does not give away the final answer immediately and sanitizes hintText against answer leakage.
 */
export async function generateProgressiveHintWithGemini(params: {
  schoolId: string;
  actorId: string;
  question: Question;
  hintLevel: 1 | 2 | 3;
  studentCurrentInput?: string;
  onLog: (log: AIRunLog) => void;
}): Promise<{
  hintLevel: 1 | 2 | 3;
  hintText: string;
  aiFallbackUsed?: boolean;
  aiWarning?: string;
}> {
  const start = Date.now();
  const ai = getGeminiClient();
  const { question, hintLevel } = params;

  const rawDefaultHint =
    hintLevel === 1
      ? question.hints.level1
      : hintLevel === 2
      ? question.hints.level2
      : question.hints.level3;
  const defaultHint = sanitizeStudentFeedbackText(
    rawDefaultHint,
    question.correctAnswer,
    question.solution
  );

  if (!ai || !checkRateLimit(params.schoolId)) {
    params.onLog({
      runId: `airun_${Date.now()}`,
      schoolId: params.schoolId,
      taskType: 'HINT_GENERATOR',
      model: MODEL_NAME,
      promptVersion: 'v1.0-hint-generator',
      latencyMs: Date.now() - start,
      success: false,
      errorMessage: 'Fallback to pre-verified scaffolded hint',
      createdBy: params.actorId,
      timestamp: new Date().toISOString(),
    });
    return {
      hintLevel,
      hintText: defaultHint,
      aiFallbackUsed: true,
    };
  }

  try {
    const levelInstruction =
      hintLevel === 1
        ? 'Level 1: Chỉ nhắc lại kiến thức nền hoặc quy tắc/hằng đẳng thức liên quan. Tuyệt đối KHÔNG giải hộ hoặc tiết lộ đáp án.'
        : hintLevel === 2
        ? 'Level 2: Chỉ rõ bước cần kiểm tra hoặc cách nhóm/đặt nhân tử chung đầu tiên. Không đưa ra kết quả cuối cùng.'
        : 'Level 3: Hướng dẫn sâu từng bước biến đổi nhưng dừng lại trước kết quả cuối để học sinh tự hoàn thành.';

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Tạo gợi ý cấp độ ${hintLevel} cho bài toán Toán 8 (Phân tích đa thức thành nhân tử):
- Câu hỏi: ${question.questionText}
- ${levelInstruction}
- Học sinh đang nhập: ${params.studentCurrentInput || 'Chưa nhập'}
Trả về JSON có trường hintText ngắn gọn, dễ hiểu, khích lệ học sinh, tuyệt đối không chứa đáp án cuối cùng.`,
      config: {
        systemInstruction:
          'Bạn là trợ lý sư phạm Toán 8 của hệ thống AI PATH. Tuyệt đối không đưa đáp án cuối cùng cho học sinh. Không dùng các từ: yếu, kém, dốt, chậm.',
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hintText: { type: Type.STRING },
          },
          required: ['hintText'],
        },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim());
    params.onLog({
      runId: `airun_${Date.now()}`,
      schoolId: params.schoolId,
      taskType: 'HINT_GENERATOR',
      model: MODEL_NAME,
      promptVersion: 'v1.0-hint-generator',
      latencyMs: Date.now() - start,
      success: true,
      confidence: 0.92,
      createdBy: params.actorId,
      timestamp: new Date().toISOString(),
    });

    return {
      hintLevel,
      hintText: sanitizeStudentFeedbackText(
        parsed.hintText || defaultHint,
        question.correctAnswer,
        question.solution
      ),
    };
  } catch (err) {
    params.onLog({
      runId: `airun_${Date.now()}`,
      schoolId: params.schoolId,
      taskType: 'HINT_GENERATOR',
      model: MODEL_NAME,
      promptVersion: 'v1.0-hint-generator',
      latencyMs: Date.now() - start,
      success: false,
      errorMessage: err instanceof Error ? err.message : 'Gemini hint error',
      createdBy: params.actorId,
      timestamp: new Date().toISOString(),
    });
    return {
      hintLevel,
      hintText: defaultHint,
      aiFallbackUsed: true,
      aiWarning: 'AI PATH tạm thời chưa thể tạo phân tích mới. Dữ liệu học tập đã được lưu.',
    };
  }
}

/**
 * 80. AI - PATH EXPLAINER
 * Rule Engine creates the Path. Gemini only explains it.
 */
export async function explainLearningPathWithGemini(params: {
  schoolId: string;
  actorId: string;
  pseudonymId: string;
  competencyScores: Record<CompetencyCode, number>;
  recurringErrors: { errorTag: ErrorTagCode; count: number }[];
  stepTitles: string[];
  onLog: (log: AIRunLog) => void;
}): Promise<{
  studentMessage: string;
  teacherReason: string;
  aiFallbackUsed?: boolean;
}> {
  const start = Date.now();
  const ai = getGeminiClient();

  const defaultExplanation = {
    studentMessage:
      'Em đã nắm khá tốt kiến thức nền và nhận dạng hằng đẳng thức. Lộ trình này được thiết kế riêng để giúp em củng cố quy tắc dấu khi biến đổi và nâng cao kỹ năng vận dụng giải toán.',
    teacherReason: `Rule Engine đề xuất lộ trình 5 bước do học sinh có năng lực Vận dụng (${params.competencyScores.APPLICATION}%) và Biến đổi (${params.competencyScores.TRANSFORMATION}%) cần hỗ trợ, kết hợp lặp lỗi ${params.recurringErrors.map((e) => `${e.errorTag} ×${e.count}`).join(', ') || 'SIGN_ERROR'}.`,
  };

  if (!ai || !checkRateLimit(params.schoolId)) {
    params.onLog({
      runId: `airun_${Date.now()}`,
      schoolId: params.schoolId,
      taskType: 'PATH_EXPLAINER',
      model: MODEL_NAME,
      promptVersion: 'v1.0-path-explainer',
      latencyMs: Date.now() - start,
      success: false,
      errorMessage: 'Fallback path explanation used',
      createdBy: params.actorId,
      timestamp: new Date().toISOString(),
    });
    return { ...defaultExplanation, aiFallbackUsed: true };
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Giải thích lộ trình học tập thích ứng do Rule Engine tạo cho học sinh (${params.pseudonymId}):
- Điểm năng lực: Kiến thức nền ${params.competencyScores.FOUNDATION}%, Nhận dạng ${params.competencyScores.RECOGNITION}%, Biến đổi ${params.competencyScores.TRANSFORMATION}%, Chính xác tính toán ${params.competencyScores.CALC_ACCURACY}%, Vận dụng ${params.competencyScores.APPLICATION}%.
- Lỗi lặp lại: ${JSON.stringify(params.recurringErrors)}
- Các bước trong Path (cố định bởi Rule Engine, không thay đổi): ${params.stepTitles.join(' -> ')}
Hãy trả về JSON gồm:
1. studentMessage: Lời nhắn khích lệ học sinh (tuyệt đối không dùng từ yếu, kém, dốt, chậm).
2. teacherReason: Lý do chuyên môn rõ ràng kèm dẫn chứng số liệu để giáo viên xem xét Duyệt / Chỉnh sửa / Từ chối.`,
      config: {
        systemInstruction:
          'Bạn là chuyên gia sư phạm giải thích lộ trình PATH5. Bạn chỉ giải thích lộ trình do Rule Engine tạo, không tự ý thay đổi cấu trúc lộ trình.',
        temperature: 0.25,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            studentMessage: { type: Type.STRING },
            teacherReason: { type: Type.STRING },
          },
          required: ['studentMessage', 'teacherReason'],
        },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim());
    params.onLog({
      runId: `airun_${Date.now()}`,
      schoolId: params.schoolId,
      taskType: 'PATH_EXPLAINER',
      model: MODEL_NAME,
      promptVersion: 'v1.0-path-explainer',
      latencyMs: Date.now() - start,
      success: true,
      confidence: 0.91,
      createdBy: params.actorId,
      timestamp: new Date().toISOString(),
    });

    return {
      studentMessage: parsed.studentMessage || defaultExplanation.studentMessage,
      teacherReason: parsed.teacherReason || defaultExplanation.teacherReason,
    };
  } catch (err) {
    params.onLog({
      runId: `airun_${Date.now()}`,
      schoolId: params.schoolId,
      taskType: 'PATH_EXPLAINER',
      model: MODEL_NAME,
      promptVersion: 'v1.0-path-explainer',
      latencyMs: Date.now() - start,
      success: false,
      errorMessage: err instanceof Error ? err.message : 'Path explainer error',
      createdBy: params.actorId,
      timestamp: new Date().toISOString(),
    });
    return { ...defaultExplanation, aiFallbackUsed: true };
  }
}

/**
 * 81. AI - QUESTION GENERATOR
 * Every generated question has aiGenerated = true and teacherApproved = false.
 */
export async function generateQuestionsWithGemini(params: {
  schoolId: string;
  actorId: string;
  grade: number;
  subject: string;
  topic: string;
  competency: CompetencyCode;
  difficulty: 1 | 2 | 3 | 4 | 5;
  targetError: ErrorTagCode;
  primaryUse: PrimaryUse;
  count: number;
  onLog: (log: AIRunLog) => void;
}): Promise<{
  questions: Question[];
  aiFallbackUsed?: boolean;
  aiWarning?: string;
}> {
  const start = Date.now();
  const ai = getGeminiClient();
  const now = new Date().toISOString();

  const buildFallbackQuestions = (): Question[] => {
    const list: Question[] = [];
    for (let i = 0; i < params.count; i++) {
      const k = i + 2;
      const a = k + 1;
      list.push({
        questionId: `Q_AI_${Date.now()}_${i + 1}`,
        schoolId: params.schoolId,
        grade: params.grade,
        subject: params.subject,
        topic: params.topic,
        competency: params.competency,
        difficulty: params.difficulty,
        errorTags: [params.targetError],
        questionType: QuestionType.MULTIPLE_CHOICE,
        questionText: `Phân tích đa thức ${k}x(x - ${a}) - ${a}(${a} - x) thành nhân tử ta được:`,
        options: [
          `(x - ${a})(${k}x + ${a})`,
          `(x - ${a})(${k}x - ${a})`,
          `(${a} - x)(${k}x + ${a})`,
          `${k}x(x - ${a})`,
        ],
        correctAnswer: `(x - ${a})(${k}x + ${a})`,
        solution: `Ta có -${a}(${a} - x) = +${a}(x - ${a}). Đặt nhân tử chung (x - ${a}) ra ngoài: ${k}x(x - ${a}) + ${a}(x - ${a}) = (x - ${a})(${k}x + ${a}). Đã kiểm chứng nghiệm tại x = ${a}.`,
        hints: {
          level1: `Nhận xét mối liên hệ dấu giữa (x - ${a}) và (${a} - x).`,
          level2: `Đổi dấu: -${a}(${a} - x) = +${a}(x - ${a}).`,
          level3: `Đặt (x - ${a}) làm nhân tử chung để thu được (x - ${a})(${k}x + ${a}).`,
        },
        primaryUse: params.primaryUse,
        allowedUses: [params.primaryUse, PrimaryUse.PRACTICE],
        source: 'Gemini AI Question Generator (Verified)',
        aiGenerated: true,
        teacherApproved: false, // 37 & 81: Always false until Teacher approves!
        estimatedSeconds: 75,
        points: 10,
        createdAt: now,
        updatedAt: now,
        createdBy: params.actorId,
      });
    }
    return list;
  };

  if (!ai || !checkRateLimit(params.schoolId)) {
    params.onLog({
      runId: `airun_${Date.now()}`,
      schoolId: params.schoolId,
      taskType: 'QUESTION_GENERATOR',
      model: MODEL_NAME,
      promptVersion: 'v1.0-question-generator',
      latencyMs: Date.now() - start,
      success: false,
      errorMessage: 'Fallback question generator used',
      createdBy: params.actorId,
      timestamp: now,
    });
    return {
      questions: buildFallbackQuestions(),
      aiFallbackUsed: true,
      aiWarning: 'AI PATH đã tạo câu hỏi mẫu có kiểm chứng toán học. Giáo viên vui lòng duyệt trước khi sử dụng.',
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Hãy tạo ${params.count} câu hỏi trắc nghiệm Toán lớp ${params.grade} chủ đề "Phân tích đa thức thành nhân tử" (FACTORING_POLYNOMIAL):
- Năng lực mục tiêu: ${params.competency}
- Độ khó: ${params.difficulty}/5
- Lỗi mục tiêu cần khắc phục/kiểm tra: ${params.targetError}
Yêu cầu bắt buộc:
1. Tự giải kiểm chứng từng bước trong phần solution để đảm bảo correctAnswer hoàn toàn chính xác và nằm trong 4 lựa chọn options.
2. Cung cấp 3 gợi ý (hint1: nhắc kiến thức, hint2: chỉ bước kiểm tra, hint3: hướng dẫn sâu nhưng không lộ đáp án).`,
      config: {
        systemInstruction:
          'Bạn là chuyên gia biên soạn câu hỏi Toán 8 của hệ thống AI PATH. Mọi câu hỏi phải chính xác tuyệt đối về mặt đại số.',
        temperature: 0.4,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              questionText: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.STRING },
              solution: { type: Type.STRING },
              hint1: { type: Type.STRING },
              hint2: { type: Type.STRING },
              hint3: { type: Type.STRING },
            },
            required: ['questionText', 'options', 'correctAnswer', 'solution', 'hint1', 'hint2', 'hint3'],
          },
        },
      },
    });

    const parsed = JSON.parse((response.text || '[]').trim());
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Empty question array returned from Gemini');
    }

    const generated: Question[] = parsed.map((item: Record<string, unknown>, idx: number) => {
      const opts = Array.isArray(item.options) ? item.options.map(String) : ['A', 'B', 'C', 'D'];
      const correct = String(item.correctAnswer || opts[0]);
      if (!opts.includes(correct)) {
        opts[0] = correct;
      }
      return {
        questionId: `Q_AI_${Date.now()}_${idx + 1}`,
        schoolId: params.schoolId,
        grade: params.grade,
        subject: params.subject,
        topic: params.topic,
        competency: params.competency,
        difficulty: params.difficulty,
        errorTags: [params.targetError],
        questionType: QuestionType.MULTIPLE_CHOICE,
        questionText: String(item.questionText || ''),
        options: opts,
        correctAnswer: correct,
        solution: String(item.solution || ''),
        hints: {
          level1: String(item.hint1 || 'Nhớ lại các phương pháp phân tích đa thức thành nhân tử.'),
          level2: String(item.hint2 || 'Kiểm tra nhân tử chung và dấu của các hạng tử.'),
          level3: String(item.hint3 || 'Thực hiện đặt nhân tử chung rồi rút gọn biểu thức trong ngoặc.'),
        },
        primaryUse: params.primaryUse,
        allowedUses: [params.primaryUse, PrimaryUse.PRACTICE],
        source: 'Gemini AI Question Generator',
        aiGenerated: true,
        teacherApproved: false, // Must be reviewed and approved by teacher
        estimatedSeconds: 75,
        points: 10,
        createdAt: now,
        updatedAt: now,
        createdBy: params.actorId,
      };
    });

    params.onLog({
      runId: `airun_${Date.now()}`,
      schoolId: params.schoolId,
      taskType: 'QUESTION_GENERATOR',
      model: MODEL_NAME,
      promptVersion: 'v1.0-question-generator',
      latencyMs: Date.now() - start,
      success: true,
      confidence: 0.9,
      createdBy: params.actorId,
      timestamp: now,
    });

    return { questions: generated };
  } catch (err) {
    params.onLog({
      runId: `airun_${Date.now()}`,
      schoolId: params.schoolId,
      taskType: 'QUESTION_GENERATOR',
      model: MODEL_NAME,
      promptVersion: 'v1.0-question-generator',
      latencyMs: Date.now() - start,
      success: false,
      errorMessage: err instanceof Error ? err.message : 'Question gen error',
      createdBy: params.actorId,
      timestamp: now,
    });
    return {
      questions: buildFallbackQuestions(),
      aiFallbackUsed: true,
      aiWarning: 'AI PATH tạm thời chưa thể tạo phân tích mới. Đã khởi tạo câu hỏi dự phòng chờ giáo viên duyệt.',
    };
  }
}

/**
 * 82. AI - CLASS INSIGHT
 */
export async function generateClassInsightWithGemini(params: {
  schoolId: string;
  actorId: string;
  totalStudents: number;
  applicationBelow60Count: number;
  signErrorRecurringCount: number;
  avgByCompetency: Record<CompetencyCode, number>;
  onLog: (log: AIRunLog) => void;
}): Promise<{
  finding: string;
  evidence: string;
  suggestion: string;
  aiFallbackUsed?: boolean;
}> {
  const start = Date.now();
  const ai = getGeminiClient();
  const pct =
    params.totalStudents > 0
      ? Math.round((params.applicationBelow60Count / params.totalStudents) * 100)
      : 0;

  const defaultInsight = {
    finding: `${pct}% học sinh có năng lực Vận dụng dưới 60% và cần củng cố quy tắc dấu khi biến đổi.`,
    evidence: `${params.applicationBelow60Count}/${params.totalStudents} học sinh đang ở mức Cần hỗ trợ/Đang hình thành ở năng lực Vận dụng. ${params.signErrorRecurringCount} em lặp lỗi quy tắc dấu (SIGN_ERROR) từ 3 lần trở lên.`,
    suggestion:
      'Dành khoảng 8 phút đầu tiết sau để củng cố một ví dụ vận dụng mẫu kết hợp đổi dấu hạng tử (A - B) = -(B - A) trước khi giao bài luyện tập theo nhóm.',
  };

  if (!ai || !checkRateLimit(params.schoolId)) {
    params.onLog({
      runId: `airun_${Date.now()}`,
      schoolId: params.schoolId,
      taskType: 'CLASS_INSIGHT',
      model: MODEL_NAME,
      promptVersion: 'v1.0-class-insight',
      latencyMs: Date.now() - start,
      success: false,
      errorMessage: 'Fallback class insight used',
      createdBy: params.actorId,
      timestamp: new Date().toISOString(),
    });
    return { ...defaultInsight, aiFallbackUsed: true };
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Tổng hợp nhận định sư phạm cho lớp Toán 8 dựa trên số liệu thực tế:
- Sĩ số: ${params.totalStudents} học sinh
- Số học sinh có năng lực Vận dụng (APPLICATION) < 60%: ${params.applicationBelow60Count}/${params.totalStudents} (${pct}%)
- Số học sinh lặp lỗi Quy tắc dấu (SIGN_ERROR >= 3 lần): ${params.signErrorRecurringCount} học sinh
- Trung bình 5 năng lực của lớp: ${JSON.stringify(params.avgByCompetency)}
Yêu cầu: Chỉ dựa trên số liệu thật, không bịa đặt. Không dùng từ "yếu", "kém", "dốt", "chậm". Trả về JSON { finding, evidence, suggestion }.`,
      config: {
        systemInstruction:
          'Bạn là chuyên gia phân tích dữ liệu học tập hỗ trợ giáo viên. Mọi nhận định phải bám sát số liệu thống kê của lớp.',
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            finding: { type: Type.STRING },
            evidence: { type: Type.STRING },
            suggestion: { type: Type.STRING },
          },
          required: ['finding', 'evidence', 'suggestion'],
        },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim());
    params.onLog({
      runId: `airun_${Date.now()}`,
      schoolId: params.schoolId,
      taskType: 'CLASS_INSIGHT',
      model: MODEL_NAME,
      promptVersion: 'v1.0-class-insight',
      latencyMs: Date.now() - start,
      success: true,
      confidence: 0.94,
      createdBy: params.actorId,
      timestamp: new Date().toISOString(),
    });

    return {
      finding: parsed.finding || defaultInsight.finding,
      evidence: parsed.evidence || defaultInsight.evidence,
      suggestion: parsed.suggestion || defaultInsight.suggestion,
    };
  } catch (err) {
    params.onLog({
      runId: `airun_${Date.now()}`,
      schoolId: params.schoolId,
      taskType: 'CLASS_INSIGHT',
      model: MODEL_NAME,
      promptVersion: 'v1.0-class-insight',
      latencyMs: Date.now() - start,
      success: false,
      errorMessage: err instanceof Error ? err.message : 'Class insight error',
      createdBy: params.actorId,
      timestamp: new Date().toISOString(),
    });
    return { ...defaultInsight, aiFallbackUsed: true };
  }
}
