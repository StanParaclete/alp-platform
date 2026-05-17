/**
 * ALP Platform — Database Seed
 * Creates demo accounts, sample school, students, and ALP plans
 * Built by Stan Paraclete | www.stanparaclete.com
 *
 * Run: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ALP Platform database...');

  // ─── District ──────────────────────────────────────────────────────────────
  const district = await prisma.district.upsert({
    where: { code: 'WESTWOOD-DIST' },
    update: {},
    create: {
      name: 'Westwood Unified School District',
      code: 'WESTWOOD-DIST',
      country: 'US',
      state: 'VA',
      region: 'Northern Virginia',
      framework: 'IDEA_USA',
    },
  });
  console.log('✅ District created:', district.name);

  // ─── School ────────────────────────────────────────────────────────────────
  const school = await prisma.school.upsert({
    where: { code: 'WESTWOOD-ELEM' },
    update: { districtId: district.id },
    create: {
      districtId: district.id,
      name: 'Westwood Elementary School',
      code: 'WESTWOOD-ELEM',
      address: '123 Westwood Drive',
      city: 'Alexandria',
      country: 'US',
      phone: '+1-703-555-0100',
      principalName: 'Dr. Jennifer Walsh',
    },
  });
  console.log('✅ School created:', school.name);

  // ─── Demo Users ────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('ALPDemo2026!', 12);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@growwithalp.com' },
      update: {},
      create: {
        email: 'admin@growwithalp.com',
        passwordHash,
        firstName: 'Admin',
        lastName: 'User',
        role: 'SUPER_ADMIN',
        districtId: district.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'ms.simmons@westwood.edu' },
      update: {},
      create: {
        email: 'ms.simmons@westwood.edu',
        passwordHash,
        firstName: 'Sarah',
        lastName: 'Simmons',
        role: 'SPECIAL_ED_TEACHER',
        schoolId: school.id,
        districtId: district.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'mr.chen@westwood.edu' },
      update: {},
      create: {
        email: 'mr.chen@westwood.edu',
        passwordHash,
        firstName: 'David',
        lastName: 'Chen',
        role: 'TEACHER',
        schoolId: school.id,
        districtId: district.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'parent@demo.com' },
      update: {},
      create: {
        email: 'parent@demo.com',
        passwordHash,
        firstName: 'Patricia',
        lastName: 'Johnson',
        role: 'PARENT',
        schoolId: school.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'school.admin@westwood.edu' },
      update: {},
      create: {
        email: 'school.admin@westwood.edu',
        passwordHash,
        firstName: 'Jennifer',
        lastName: 'Walsh',
        role: 'SCHOOL_ADMIN',
        schoolId: school.id,
        districtId: district.id,
        isActive: true,
      },
    }),
  ]);
  console.log('✅ Demo users created:', users.map(u => u.email));

  const teacher = users.find(u => u.email === 'ms.simmons@westwood.edu');

  // ─── Students ──────────────────────────────────────────────────────────────
  const studentsData = [
    {
      firstName: 'Marcus', lastName: 'Johnson', grade: '4',
      dateOfBirth: new Date('2016-03-12'),
      disability: 'AUTISM',
    },
    {
      firstName: 'Sofia', lastName: 'Lee', grade: '2',
      dateOfBirth: new Date('2018-07-22'),
      disability: 'DYSLEXIA',
    },
    {
      firstName: 'Tyler', lastName: 'Parker', grade: '6',
      dateOfBirth: new Date('2014-11-05'),
      disability: 'ADHD',
    },
    {
      firstName: 'Aisha', lastName: 'Adeyemi', grade: '3',
      dateOfBirth: new Date('2017-04-18'),
      disability: 'SPEECH_LANGUAGE',
    },
    {
      firstName: 'Ryan', lastName: 'Chen', grade: '5',
      dateOfBirth: new Date('2015-09-30'),
      disability: 'INTELLECTUAL',
    },
    {
      firstName: 'Emma', lastName: 'Williams', grade: '1',
      dateOfBirth: new Date('2019-01-14'),
      disability: 'HEARING_IMPAIRMENT',
    },
  ];

  const students = [];
  for (const s of studentsData) {
    const student = await prisma.student.create({
      data: {
        schoolId: school.id,
        firstName: s.firstName,
        lastName: s.lastName,
        dateOfBirth: s.dateOfBirth,
        grade: s.grade,
        primaryLanguage: 'English',
        supportLevel: 2,
        teachers: { connect: [{ id: teacher.id }] },
        disabilities: {
          create: [{ category: s.disability, isPrimary: true }],
        },
      },
    });
    students.push(student);
  }
  console.log('✅ Students created:', students.map(s => `${s.firstName} ${s.lastName}`));

  // ─── ALP Plans + Goals ─────────────────────────────────────────────────────
  const marcus = students[0];
  const now = new Date();
  const nextYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  const plan = await prisma.aLPPlan.create({
    data: {
      studentId: marcus.id,
      createdById: teacher.id,
      planType: 'ALP',
      status: 'ACTIVE',
      framework: 'IDEA_USA',
      effectiveDate: now,
      reviewDate: nextYear,
      completionPct: 100,
      isCompliant: true,
      studentInfo: {
        name: 'Marcus Darnell Johnson',
        dob: '2016-03-12',
        grade: '4',
        school: 'Westwood Elementary',
        coordinator: 'Ms. Simmons',
      },
      presentLevels: {
        reading: 'Marcus reads at a 2nd grade level with 52 wcpm on grade 3 probes.',
        math: 'Marcus demonstrates understanding of addition/subtraction but struggles with multi-step problems.',
        communication: 'Marcus initiates 1-turn conversations. Needs support with sustained peer interaction.',
        socialEmotional: 'Marcus needs prompting to identify and regulate emotions, especially frustration.',
      },
      goals: {
        create: [
          {
            domain: 'READING',
            description: 'By May 2027, Marcus will read grade 3-level text aloud with 90% accuracy (at least 80 wcpm) across 4 consecutive weekly probes, measured by CBM assessments.',
            baseline: '52 wcpm',
            target: '80 wcpm',
            method: 'CBM weekly probes',
            monitoring: 'Weekly',
            status: 'ACTIVE',
            orderIndex: 0,
            progress: {
              create: [
                { recordedBy: teacher.id, value: 52, unit: 'wcpm', recordedAt: new Date('2026-09-01') },
                { recordedBy: teacher.id, value: 56, unit: 'wcpm', recordedAt: new Date('2026-10-01') },
                { recordedBy: teacher.id, value: 59, unit: 'wcpm', recordedAt: new Date('2026-11-01') },
                { recordedBy: teacher.id, value: 62, unit: 'wcpm', recordedAt: new Date('2027-01-01') },
                { recordedBy: teacher.id, value: 65, unit: 'wcpm', recordedAt: new Date('2027-03-01') },
                { recordedBy: teacher.id, value: 68, unit: 'wcpm', recordedAt: new Date('2027-05-01') },
              ],
            },
          },
          {
            domain: 'COMMUNICATION',
            description: 'By May 2027, Marcus will initiate and maintain a 3-turn conversation with a peer on a preferred topic in 4 of 5 observed opportunities.',
            baseline: '1-turn conversation',
            target: '3-turn conversation in 4/5 opportunities',
            method: 'Direct observation',
            monitoring: 'Monthly',
            status: 'ACTIVE',
            orderIndex: 1,
          },
          {
            domain: 'SOCIAL_EMOTIONAL',
            description: 'By May 2027, Marcus will use a self-regulation strategy independently when identifying frustration in 4 of 5 daily opportunities.',
            baseline: 'Requires adult prompting',
            target: 'Independent in 4/5 opportunities',
            method: 'Behavior observation log',
            monitoring: 'Weekly',
            status: 'ACTIVE',
            orderIndex: 2,
          },
        ],
      },
      accommodations: [
        { category: 'Testing', description: 'Extended time — 1.5x on all assessments' },
        { category: 'Presentation', description: 'Preferential seating near the front of class' },
        { category: 'Response', description: 'Oral responses permitted for written tasks' },
        { category: 'Setting', description: 'Small group testing environment' },
        { category: 'Technology', description: 'Text-to-speech software for reading passages' },
      ],
      services: [
        { type: 'SPECIAL_ED_INSTRUCTION', frequency: '5x/week', duration: 60, setting: 'Resource room' },
        { type: 'SPEECH_LANGUAGE', frequency: '2x/week', duration: 30, setting: 'Pull-out' },
        { type: 'OCCUPATIONAL_THERAPY', frequency: '1x/week', duration: 30, setting: 'Pull-out' },
      ],
    },
  });
  console.log('✅ ALP Plan created for Marcus Johnson');

  // ─── Signature request ─────────────────────────────────────────────────────
  const parent = users.find(u => u.email === 'parent@demo.com');
  await prisma.signature.create({
    data: {
      alpId: plan.id,
      userId: parent.id,
      role: 'parent',
      status: 'PENDING',
    },
  });

  // ─── Notifications ─────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { userId: teacher.id, title: 'Review Due', body: "Sofia Lee's ALP is due for annual review in 15 days.", type: 'review_due', data: {} },
      { userId: teacher.id, title: 'Signature Pending', body: "Marcus Johnson's ALP requires parent signature.", type: 'signature_needed', data: { alpId: plan.id } },
      { userId: teacher.id, title: 'Progress Alert', body: "Ryan Chen's reading goal is at risk — below expected trajectory.", type: 'goal_alert', data: {} },
    ],
  });

  // ─── Meetings ──────────────────────────────────────────────────────────────
  await prisma.meeting.createMany({
    data: [
      {
        title: 'Johnson Family — ALP Review',
        type: 'ANNUAL_REVIEW',
        studentId: marcus.id,
        scheduledAt: new Date('2026-05-14T15:30:00'),
        duration: 60,
        isVirtual: true,
        meetingLink: 'https://meet.google.com/alp-johnson-review',
        status: 'scheduled',
      },
      {
        title: 'Adeyemi Family — Progress Check',
        type: 'PROGRESS_CHECK',
        studentId: students[3].id,
        scheduledAt: new Date('2026-05-20T16:00:00'),
        duration: 30,
        isVirtual: false,
        location: 'Room 14, Westwood Elementary',
        status: 'scheduled',
      },
    ],
  });

  // ─── Subscription ─────────────────────────────────────────────────────────
  await prisma.subscription.create({
    data: {
      districtId: district.id,
      plan: 'professional',
      status: 'active',
      seats: 50,
      usedSeats: 3,
      startsAt: new Date('2026-01-01'),
      expiresAt: new Date('2027-01-01'),
    },
  });

  console.log('\n🎉 Seed complete! Demo credentials:');
  console.log('─────────────────────────────────────────────────');
  console.log('Super Admin:    admin@growwithalp.com');
  console.log('Teacher:        ms.simmons@westwood.edu');
  console.log('School Admin:   school.admin@westwood.edu');
  console.log('Parent:         parent@demo.com');
  console.log('Password:       ALPDemo2026!');
  console.log('─────────────────────────────────────────────────');
  console.log('Built by Stan Paraclete | www.stanparaclete.com\n');
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

// ─── Additional Demo Users for 7-Role System ───────────────────────────────
async function seedRoles(districtId, schoolId, passwordHash) {
  const roles = [
    { email:'principal@westwood.edu',    firstName:'Principal',  lastName:'Owusu',    role:'SCHOOL_ADMIN',       alpRole:'leadership'  },
    { email:'intervention@westwood.edu', firstName:'Kofi',       lastName:'Mensah',   role:'TEACHER',            alpRole:'intervention'},
    { email:'ms.rivera@westwood.edu',    firstName:'Ana',        lastName:'Rivera',   role:'THERAPIST',          alpRole:'related'     },
    { email:'parent@demo.com',           firstName:'Patricia',   lastName:'Johnson',  role:'PARENT',             alpRole:'family'      },
    { email:'marcus@student.demo.com',   firstName:'Marcus',     lastName:'Johnson',  role:'STUDENT',            alpRole:'student'     },
  ];
  for (const u of roles) {
    await prisma.user.upsert({
      where: { email: u.email }, update: {},
      create: { ...u, passwordHash, districtId, schoolId, isActive: true },
    });
    console.log(`✅ User created: ${u.firstName} ${u.lastName} (${u.alpRole})`);
  }
}
// Call seedRoles in main() if you want all 7 demo roles seeded
