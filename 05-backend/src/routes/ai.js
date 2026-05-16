/**
 * ALP Platform — AI Service Routes
 * Goal generation, narrative writing, progress risk prediction,
 * accommodation suggestions, parent-friendly summaries
 */

import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { prisma } from '../db.js';
const redis = { get: async () => null, set: async () => 'OK', del: async () => 1 };
import { rateLimit } from 'express-rate-limit';
import { ALP_SYSTEM_PROMPT } from '../services/aiPrompt.js';

const router = express.Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
router.use(aiLimiter);

const SYSTEM_PROMPT = `You are an expert special education consultant for the ALP (Accelerated Learning Plan) Platform.
You help educators create high-quality, measurable, research-based intervention plans for diverse learners worldwide.
You are knowledgeable about IDEA, Section 504, Ghana GES, Nigeria NERDC, UK SEND, and other global frameworks.
Always write goals using the SMART format: Specific, Measurable, Achievable, Relevant, Time-bound.
Goals must include: condition, student name, behavior, criterion, timeline, and measurement method.
Be culturally sensitive and globally applicable. Keep language professional yet accessible.
Never include personally identifiable information beyond what is provided.`;

// POST /api/ai/suggest-goals
router.post('/suggest-goals', async (req, res) => {
  try {
    const schema = z.object({
      studentId: z.string(),
      domains: z.array(z.string()).min(1),
      presentLevels: z.string().optional(),
      disability: z.string().optional(),
      grade: z.string().optional(),
      baselineData: z.record(z.any()).optional(),
    });
    const { studentId, domains, presentLevels, disability, grade, baselineData } = schema.parse(req.body);

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { firstName: true, grade: true, disabilities: true },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const cacheKey = `ai:goals:${studentId}:${domains.join(',')}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const prompt = `Generate measurable annual goals for ${student.firstName}, a ${grade || student.grade} student with ${disability || student.disabilities.map(d => d.category).join(', ')}.

Present Levels: ${presentLevels || 'Not provided'}
Target Domains: ${domains.join(', ')}
Baseline Data: ${JSON.stringify(baselineData || {})}

For each domain, provide:
1. A complete SMART annual goal statement
2. Baseline performance
3. Target criterion
4. Measurement method
5. Monitoring frequency
6. 3-5 short-term objectives

Format as JSON array with this structure:
[{
  "domain": "READING",
  "goalText": "By [date], [student] will...",
  "baseline": "currently...",
  "target": "X% / Y wcpm / etc",
  "method": "CBM / observation / standardized assessment",
  "monitoring": "Weekly / Monthly / Quarterly",
  "objectives": ["objective 1", "objective 2", "objective 3"]
}]`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const goals = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    await redis.set(cacheKey, JSON.stringify({ goals }), { EX: 3600 });
    res.json({ goals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/suggest-accommodations
router.post('/suggest-accommodations', async (req, res) => {
  try {
    const { disability, grade, testingConcerns, learningProfile } = req.body;

    const prompt = `Suggest appropriate accommodations and modifications for a student with ${disability} in grade ${grade}.

Learning Profile: ${learningProfile || 'Not provided'}
Testing Concerns: ${testingConcerns || 'None specified'}

Provide accommodations in these categories:
1. Presentation (how information is given)
2. Response (how student shows learning)
3. Setting (where student works)
4. Timing/Scheduling
5. Testing accommodations
6. Assistive technology

Format as JSON:
{
  "presentation": [...],
  "response": [...],
  "setting": [...],
  "timing": [...],
  "testing": [...],
  "technology": [...]
}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const accommodations = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    res.json({ accommodations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/generate-narrative
router.post('/generate-narrative', async (req, res) => {
  try {
    const { section, data, studentName, tone } = req.body;

    const toneMap = {
      professional: 'professional and clinical',
      family: 'warm, clear, and accessible to non-educators',
      student: 'encouraging and strengths-based for the student',
    };

    const prompt = `Write a ${section} narrative for ${studentName}'s ALP document.
Tone: ${toneMap[tone] || toneMap.professional}
Data to incorporate: ${JSON.stringify(data)}

Write 2-3 clear, professional paragraphs. Do not use jargon without explanation. Focus on the student as a whole person.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    res.json({ narrative: response.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/predict-risk
router.post('/predict-risk', async (req, res) => {
  try {
    const { studentId } = req.body;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        alpPlans: {
          where: { status: 'ACTIVE' },
          include: { goals: { include: { progress: { orderBy: { recordedAt: 'desc' }, take: 6 } } } },
        },
      },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const progressSummary = student.alpPlans[0]?.goals.map(g => ({
      domain: g.domain,
      recentScores: g.progress.map(p => p.value),
      trend: g.progress.length >= 2 ? (g.progress[0].value - g.progress[g.progress.length - 1].value) : 0,
    }));

    const prompt = `Analyze this student's progress data and predict risk of not meeting annual goals.

Progress Data: ${JSON.stringify(progressSummary)}

Provide:
1. Overall risk level: LOW / MEDIUM / HIGH / CRITICAL
2. Risk factors for each goal domain
3. Recommended immediate interventions
4. Monitoring frequency recommendations

Format as JSON:
{
  "overallRisk": "MEDIUM",
  "riskByDomain": { "READING": { "risk": "HIGH", "reason": "..." } },
  "interventions": [...],
  "recommendedFrequency": "..."
}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const prediction = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    res.json({ prediction, studentId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/parent-summary
router.post('/parent-summary', async (req, res) => {
  try {
    const { alpId } = req.body;

    const plan = await prisma.aLPPlan.findUnique({
      where: { id: alpId },
      include: {
        student: true,
        goals: true,
      },
    });
    if (!plan) return res.status(404).json({ error: 'ALP not found' });

    const prompt = `Write a parent-friendly summary of this student's ALP.

Student: ${plan.student.firstName} ${plan.student.lastName}, Grade ${plan.student.grade}
Goals: ${JSON.stringify(plan.goals.map(g => ({ domain: g.domain, description: g.description, target: g.target })))}

Write in simple, warm language that a parent/guardian without educational background can understand.
Avoid acronyms without explanation. Be encouraging and strengths-based.
Include: what the plan is, what the goals mean in everyday terms, how progress will be measured, and how the family can help at home.
Keep it to 3-4 paragraphs.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    res.json({ summary: response.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/suggest-interventions
router.post('/suggest-interventions', async (req, res) => {
  try {
    const { domain, baseline, disability, grade, resources } = req.body;

    const prompt = `Suggest evidence-based interventions for a grade ${grade} student with ${disability} struggling in ${domain}.

Current Baseline: ${baseline}
Available Resources: ${resources || 'General classroom, small group, one-on-one'}

Provide 5 research-based intervention strategies including:
- Strategy name and description
- Frequency and duration
- Materials needed
- How to measure effectiveness
- Estimated timeline for improvement

Format as JSON array.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const interventions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    res.json({ interventions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
