export const pages = {
  about: {
    title: 'About ALP', eyebrow: 'A learner-first purpose', image: 'community',
    intro: 'Learning support begins with knowing a person, not filling a template. ALP gives educators a shared record of what a learner needs, what the team will try and what happens next.',
    sections: [
      { title: 'A plan that belongs to the learner', text: 'Accelerated Learning Plan is an intervention platform. It connects strengths, needs, goals, classroom support and review in one continuing process. It is not a replacement for professional judgement or a promise that one approach works for everyone.' },
      { title: 'Teachers at the centre', text: 'Teachers and support specialists turn plans into daily practice. School leaders coordinate responsibilities and review. Families contribute knowledge of the learner and receive understandable progress updates.' },
      { title: 'A global perspective', text: 'Schools differ in language, resources and educational policy. ALP is being developed for that diversity. Each institution remains responsible for choosing appropriate approaches and meeting its local obligations.' }
    ]
  },
  features: {
    title: 'The ALP platform', eyebrow: 'Plan. Support. Review.', image: 'reading',
    intro: 'Keep learning goals connected to the evidence and conversations that make them useful.',
    sections: [
      { title: 'Learner records', text: 'Bring the learner’s strengths, needs, school information and support history into the planning conversation. A clear starting point helps teams distinguish what they know from what still needs investigation.' },
      { title: 'Intervention planning', text: 'Write measurable goals, identify accommodations and describe how support will be delivered. Give each goal a baseline, a way to measure change and a review date.' },
      { title: 'Progress monitoring', text: 'Record observations and measurements over time. Look at the pattern behind a result and use it to decide whether to continue, adapt or review an intervention.' },
      { title: 'Team review and reports', text: 'Bring plans to a school review, retain the supporting evidence and export a readable ALP document. Share only the information appropriate for each recipient.' },
      { title: 'AI-assisted drafting', text: 'Request drafting support for goals and educational narratives. Educators review and approve suggestions. AI output is not an assessment, diagnosis or automated decision about a learner.' }
    ]
  },
  'how-alp-works': {
    title: 'How ALP works', eyebrow: 'A continuous learning cycle', image: 'class',
    intro: 'Start with the learner. Agree a plan. Collect useful evidence. Review together.',
    sections: [
      { title: '01 / Understand', text: 'Gather the learner’s strengths, current performance and priorities. Include classroom observations and the family’s perspective, and record the source and date of baseline information.' },
      { title: '02 / Plan', text: 'Set a manageable set of goals. Describe the intervention, who will deliver it, when it will happen and what accommodations make participation possible.' },
      { title: '03 / Support', text: 'Put the plan into practice and record progress in context. Note changes in attendance, environment or delivery that could affect the evidence.' },
      { title: '04 / Review', text: 'Compare evidence with the baseline and agreed goal. Discuss what the learner is experiencing. Document the decision, the people involved and the next review date.' }
    ]
  },
  'who-we-serve': {
    title: 'Who we serve', eyebrow: 'One purpose. Many settings.', image: 'children',
    intro: 'ALP is built around the people providing learning support, across schools and educational organisations.',
    sections: [
      { title: 'Teachers and support specialists', text: 'Organise a caseload, write clear goals and maintain an evidence trail. Bring specialist observations into the same planning process as classroom support.' },
      { title: 'Schools and learning centres', text: 'Coordinate staff, make review responsibilities visible and keep records organised across a team. Start with the workflows your educators already use.' },
      { title: 'Districts, NGOs and public programmes', text: 'Discuss multi-school requirements, local policy, connectivity and reporting before rollout. Programme-wide access requires an agreed data-governance and deployment plan.' },
      { title: 'Learners and families', text: 'The learner’s voice and family knowledge inform the plan. In the current live release, staff manage guardian contacts and share updates; separate family and student accounts are part of the expanded platform being built.' }
    ]
  },
  solutions: {
    title: 'Learning support solutions', eyebrow: 'Support shaped around need', image: 'reading',
    intro: 'A learner may need a different route, a different pace or a different way to participate. The plan should make that support concrete.',
    sections: [
      { title: 'Early intervention', text: 'Record emerging needs, agree small observable goals and schedule timely reviews. Keep the information useful for the adults working with the learner each day.' },
      { title: 'Literacy and numeracy', text: 'Connect a starting point to focused teaching and repeated measures. Distinguish a skill gap from barriers such as access, language or inconsistent opportunity to learn.' },
      { title: 'Inclusive classrooms', text: 'Describe accommodations and supports in practical terms: what changes, when it applies and who is responsible. Review access and participation alongside attainment.' },
      { title: 'Readiness and transitions', text: 'Bring future priorities into planning, including independence, communication and transitions between settings. Agree how relevant information can be shared with the next team.' }
    ]
  },
  partners: {
    title: 'Partner with ALP', eyebrow: 'Build better support together', image: 'community',
    intro: 'We welcome conversations with schools, learning centres, NGOs and implementation partners who want to strengthen intervention practice.',
    sections: [
      { title: 'School partnerships', text: 'Bring a real planning workflow, a small implementation team and clear success criteria. A useful evaluation includes staff time, evidence quality, accessibility and the experience of learners and families.' },
      { title: 'Programme partnerships', text: 'Tell us about your geography, languages, school network and connectivity constraints. We will discuss governance, deployment and training before proposing an implementation.' },
      { title: 'Research and practice', text: 'Share a specific question or evaluation proposal. Access to identifiable records is never implied by a partnership and must be governed separately by the responsible institution.' }
    ]
  }
};

export const articles = [
  { slug: 'from-baseline-to-goal', title: 'From a baseline to a useful learning goal', category: 'Planning', image: 'reading', summary: 'Keep the starting point, the intended change and the measurement connected.', paragraphs: [
    'A baseline describes what a learner currently does under known conditions. A goal describes a meaningful next step. Keeping those two statements connected makes a plan easier to deliver and review.',
    'Record when and how the baseline was gathered. A single score without context can hide important information about the task, the environment or the support provided.',
    'Specify the behaviour you will observe, the conditions in which it will happen and the measure used to judge progress. Choose a review interval that gives the intervention time to work while allowing the team to respond.',
    'Before finalising the goal, ask the learner and the adults supporting them whether the intended change matters in everyday learning. A technically measurable goal is not automatically a useful one.' ] },
  { slug: 'progress-with-context', title: 'Progress is a pattern, not a single score', category: 'Progress', image: 'class', summary: 'Use repeated observations and delivery notes to make reviews more useful.', paragraphs: [
    'A progress record is most useful when it captures both a result and the circumstances around it. Attendance, task difficulty, prompting and changes in routine can all help explain variation.',
    'Use comparable measures over time where possible. Record the date and the support provided. If the measurement changes, note that change rather than treating unlike scores as directly comparable.',
    'At review, look for a pattern and consider whether the intervention was delivered as planned. A flat trend can call for better evidence, a change in delivery or a different approach; it does not define the learner’s potential.',
    'Document the next decision clearly: what will continue, what will change, who is responsible and when the team will review again.' ] },
  { slug: 'family-review-conversations', title: 'Making review conversations understandable', category: 'Collaboration', image: 'learningAtHome', summary: 'Translate the record into a conversation about the learner’s experience.', paragraphs: [
    'Families bring knowledge that a school record cannot fully capture. A review should leave room for that knowledge and for the learner’s own perspective.',
    'Start with strengths and an ordinary-language explanation of the goal. Explain the measure without assuming familiarity with educational abbreviations. Separate observations from interpretations.',
    'Use a small number of concrete examples to describe progress. Invite questions about what is happening outside school and whether the support feels manageable.',
    'Close with an agreed next step and a way to raise questions. Share documents through the institution’s approved process and check that recipients are authorised to receive them.' ] }
];

export const resourceGroups = [
  { title: 'Planning', description: 'Starting points, priorities and goals.', article: articles[0] },
  { title: 'Progress', description: 'Evidence that supports useful decisions.', article: articles[1] },
  { title: 'Collaboration', description: 'Clearer conversations with families.', article: articles[2] }
];
