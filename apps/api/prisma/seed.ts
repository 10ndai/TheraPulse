/**
 * TheraPulse — Database Seed
 *
 * Populates the database with development fixtures:
 *   - 1 admin user
 *   - 2 therapist users (1 approved, 1 pending)
 *   - 3 client users
 *   - 3 system worksheet templates (PHQ-9, GAD-7, Mood Tracking placeholders)
 *   - 2 therapist-client relationships
 *
 * Passwords are bcrypt hashes of "Password123!" (cost factor 12) — never use
 * these in production. Run with: npm run db:seed
 */

/* eslint-disable no-console */
import { PrismaClient, UserRole, UserStatus, ApprovalStatus, WorksheetType } from '@prisma/client';

const prisma = new PrismaClient();

// bcrypt hash of "Password123!" with cost factor 12
// Generated offline — do NOT change without re-hashing
const DEV_PASSWORD_HASH = '$2b$12$DDnxnnv0aIYzJRQ/ChhH9ei8Gs5NywFub03wVQRWn5X6pVoVG3Zeu';

async function main(): Promise<void> {
  console.log('Seeding database...');

  // ── Admin ──────────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@therapulse.dev' },
    update: { passwordHash: DEV_PASSWORD_HASH },
    create: {
      email: 'admin@therapulse.dev',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  // ── Therapists ─────────────────────────────────────────────────────────────
  const therapist1 = await prisma.user.upsert({
    where: { email: 'therapist1@therapulse.dev' },
    update: { passwordHash: DEV_PASSWORD_HASH },
    create: {
      email: 'therapist1@therapulse.dev',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.THERAPIST,
      status: UserStatus.ACTIVE,
      therapistProfile: {
        create: {
          name: 'Dr. Tariro Moyo',
          bio: 'Specialises in anxiety, depression, and trauma recovery.',
          specializations: ['anxiety', 'depression', 'trauma', 'CBT'],
          qualifications: ['MSc Clinical Psychology (UZ)', 'HPCZ Registered'],
          licenseNumber: 'HPCZ-CP-00142',
          languages: ['English', 'Shona'],
          city: 'Harare',
          province: 'Harare',
          approvalStatus: ApprovalStatus.APPROVED,
          approvedById: admin.id,
        },
      },
    },
  });

  const _therapist2 = await prisma.user.upsert({
    where: { email: 'therapist2@therapulse.dev' },
    update: { passwordHash: DEV_PASSWORD_HASH },
    create: {
      email: 'therapist2@therapulse.dev',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.THERAPIST,
      status: UserStatus.PENDING,
      therapistProfile: {
        create: {
          name: 'Sibongile Dube',
          bio: 'Focused on grief counselling and family therapy.',
          specializations: ['grief', 'family-therapy', 'bereavement'],
          qualifications: ['BA Psychology (NUST)', 'SAZIT Member'],
          licenseNumber: null,
          languages: ['English', 'Ndebele'],
          city: 'Bulawayo',
          province: 'Matabeleland North',
          approvalStatus: ApprovalStatus.PENDING,
        },
      },
    },
  });

  // ── Clients ────────────────────────────────────────────────────────────────
  const client1 = await prisma.user.upsert({
    where: { email: 'client1@therapulse.dev' },
    update: { passwordHash: DEV_PASSWORD_HASH },
    create: {
      email: 'client1@therapulse.dev',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.CLIENT,
      status: UserStatus.ACTIVE,
      clientProfile: {
        create: {
          name: 'Blessing Chikwanda',
          city: 'London',
          province: null,
          // These would be AES-256-GCM ciphertext in production (TP-010)
          dateOfBirth: null,
          phone: null,
          emergencyContact: null,
        },
      },
    },
  });

  const client2 = await prisma.user.upsert({
    where: { email: 'client2@therapulse.dev' },
    update: { passwordHash: DEV_PASSWORD_HASH },
    create: {
      email: 'client2@therapulse.dev',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.CLIENT,
      status: UserStatus.ACTIVE,
      clientProfile: {
        create: {
          name: 'Farai Nhamo',
          city: 'Harare',
          province: 'Harare',
        },
      },
    },
  });

  const _client3 = await prisma.user.upsert({
    where: { email: 'client3@therapulse.dev' },
    update: { passwordHash: DEV_PASSWORD_HASH },
    create: {
      email: 'client3@therapulse.dev',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.CLIENT,
      status: UserStatus.ACTIVE,
      clientProfile: {
        create: {
          name: 'Rutendo Mufema',
          city: 'Cape Town',
          province: null,
        },
      },
    },
  });

  // ── Therapist-client relationships ─────────────────────────────────────────
  await prisma.therapistClient.upsert({
    where: {
      therapistId_clientId: {
        therapistId: therapist1.id,
        clientId: client1.id,
      },
    },
    update: {},
    create: {
      therapistId: therapist1.id,
      clientId: client1.id,
    },
  });

  await prisma.therapistClient.upsert({
    where: {
      therapistId_clientId: {
        therapistId: therapist1.id,
        clientId: client2.id,
      },
    },
    update: {},
    create: {
      therapistId: therapist1.id,
      clientId: client2.id,
    },
  });

  // ── System worksheet templates ─────────────────────────────────────────────

  const phq9Likert = [
    { value: 0, label: 'Not at all' },
    { value: 1, label: 'Several days' },
    { value: 2, label: 'More than half the days' },
    { value: 3, label: 'Nearly every day' },
  ];

  await prisma.worksheetTemplate.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {
      formSchema: {
        version: 1,
        description:
          'PHQ-9 Patient Health Questionnaire — screens for depressive symptoms over the past 2 weeks.',
        fields: [
          {
            id: 'intro',
            type: 'label',
            label: 'Instructions',
            content:
              'Over the last 2 weeks, how often have you been bothered by any of the following problems?',
          },
          {
            id: 'phq1',
            type: 'likert',
            label: 'Little interest or pleasure in doing things',
            required: true,
            options: phq9Likert,
            scoringKey: 'phq1',
          },
          {
            id: 'phq2',
            type: 'likert',
            label: 'Feeling down, depressed, or hopeless',
            required: true,
            options: phq9Likert,
            scoringKey: 'phq2',
          },
          {
            id: 'phq3',
            type: 'likert',
            label: 'Trouble falling or staying asleep, or sleeping too much',
            required: true,
            options: phq9Likert,
            scoringKey: 'phq3',
          },
          {
            id: 'phq4',
            type: 'likert',
            label: 'Feeling tired or having little energy',
            required: true,
            options: phq9Likert,
            scoringKey: 'phq4',
          },
          {
            id: 'phq5',
            type: 'likert',
            label: 'Poor appetite or overeating',
            required: true,
            options: phq9Likert,
            scoringKey: 'phq5',
          },
          {
            id: 'phq6',
            type: 'likert',
            label:
              'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
            required: true,
            options: phq9Likert,
            scoringKey: 'phq6',
          },
          {
            id: 'phq7',
            type: 'likert',
            label:
              'Trouble concentrating on things, such as reading the newspaper or watching television',
            required: true,
            options: phq9Likert,
            scoringKey: 'phq7',
          },
          {
            id: 'phq8',
            type: 'likert',
            label:
              'Moving or speaking so slowly that other people could have noticed. Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
            required: true,
            options: phq9Likert,
            scoringKey: 'phq8',
          },
          {
            id: 'phq9',
            type: 'likert',
            label: 'Thoughts that you would be better off dead, or of hurting yourself in some way',
            required: true,
            options: phq9Likert,
            scoringKey: 'phq9',
          },
        ],
      },
    },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      title: 'PHQ-9 — Patient Health Questionnaire',
      type: WorksheetType.PHQ9,
      formSchema: {
        version: 1,
        description:
          'PHQ-9 Patient Health Questionnaire — screens for depressive symptoms over the past 2 weeks.',
        fields: [
          {
            id: 'intro',
            type: 'label',
            label: 'Instructions',
            content:
              'Over the last 2 weeks, how often have you been bothered by any of the following problems?',
          },
          {
            id: 'phq1',
            type: 'likert',
            label: 'Little interest or pleasure in doing things',
            required: true,
            options: phq9Likert,
            scoringKey: 'phq1',
          },
          {
            id: 'phq2',
            type: 'likert',
            label: 'Feeling down, depressed, or hopeless',
            required: true,
            options: phq9Likert,
            scoringKey: 'phq2',
          },
          {
            id: 'phq3',
            type: 'likert',
            label: 'Trouble falling or staying asleep, or sleeping too much',
            required: true,
            options: phq9Likert,
            scoringKey: 'phq3',
          },
          {
            id: 'phq4',
            type: 'likert',
            label: 'Feeling tired or having little energy',
            required: true,
            options: phq9Likert,
            scoringKey: 'phq4',
          },
          {
            id: 'phq5',
            type: 'likert',
            label: 'Poor appetite or overeating',
            required: true,
            options: phq9Likert,
            scoringKey: 'phq5',
          },
          {
            id: 'phq6',
            type: 'likert',
            label:
              'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
            required: true,
            options: phq9Likert,
            scoringKey: 'phq6',
          },
          {
            id: 'phq7',
            type: 'likert',
            label:
              'Trouble concentrating on things, such as reading the newspaper or watching television',
            required: true,
            options: phq9Likert,
            scoringKey: 'phq7',
          },
          {
            id: 'phq8',
            type: 'likert',
            label:
              'Moving or speaking so slowly that other people could have noticed. Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
            required: true,
            options: phq9Likert,
            scoringKey: 'phq8',
          },
          {
            id: 'phq9',
            type: 'likert',
            label: 'Thoughts that you would be better off dead, or of hurting yourself in some way',
            required: true,
            options: phq9Likert,
            scoringKey: 'phq9',
          },
        ],
      },
      scoringConfig: {
        maxScore: 27,
        ranges: [
          { min: 0, max: 4, severity: 'minimal' },
          { min: 5, max: 9, severity: 'mild' },
          { min: 10, max: 14, severity: 'moderate' },
          { min: 15, max: 19, severity: 'moderately-severe' },
          { min: 20, max: 27, severity: 'severe' },
        ],
      },
      isSystem: true,
      isPublished: true,
      version: 1,
    },
  });

  const gad7Likert = phq9Likert; // same 0-3 scale

  await prisma.worksheetTemplate.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {
      formSchema: {
        version: 1,
        description:
          'GAD-7 Generalised Anxiety Disorder scale — screens for anxiety symptoms over the past 2 weeks.',
        fields: [
          {
            id: 'intro',
            type: 'label',
            label: 'Instructions',
            content:
              'Over the last 2 weeks, how often have you been bothered by any of the following problems?',
          },
          {
            id: 'gad1',
            type: 'likert',
            label: 'Feeling nervous, anxious, or on edge',
            required: true,
            options: gad7Likert,
            scoringKey: 'gad1',
          },
          {
            id: 'gad2',
            type: 'likert',
            label: 'Not being able to stop or control worrying',
            required: true,
            options: gad7Likert,
            scoringKey: 'gad2',
          },
          {
            id: 'gad3',
            type: 'likert',
            label: 'Worrying too much about different things',
            required: true,
            options: gad7Likert,
            scoringKey: 'gad3',
          },
          {
            id: 'gad4',
            type: 'likert',
            label: 'Trouble relaxing',
            required: true,
            options: gad7Likert,
            scoringKey: 'gad4',
          },
          {
            id: 'gad5',
            type: 'likert',
            label: "Being so restless that it's hard to sit still",
            required: true,
            options: gad7Likert,
            scoringKey: 'gad5',
          },
          {
            id: 'gad6',
            type: 'likert',
            label: 'Becoming easily annoyed or irritable',
            required: true,
            options: gad7Likert,
            scoringKey: 'gad6',
          },
          {
            id: 'gad7',
            type: 'likert',
            label: 'Feeling afraid, as if something awful might happen',
            required: true,
            options: gad7Likert,
            scoringKey: 'gad7',
          },
        ],
      },
    },
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      title: 'GAD-7 — Generalised Anxiety Disorder',
      type: WorksheetType.GAD7,
      formSchema: {
        version: 1,
        description:
          'GAD-7 Generalised Anxiety Disorder scale — screens for anxiety symptoms over the past 2 weeks.',
        fields: [
          {
            id: 'intro',
            type: 'label',
            label: 'Instructions',
            content:
              'Over the last 2 weeks, how often have you been bothered by any of the following problems?',
          },
          {
            id: 'gad1',
            type: 'likert',
            label: 'Feeling nervous, anxious, or on edge',
            required: true,
            options: gad7Likert,
            scoringKey: 'gad1',
          },
          {
            id: 'gad2',
            type: 'likert',
            label: 'Not being able to stop or control worrying',
            required: true,
            options: gad7Likert,
            scoringKey: 'gad2',
          },
          {
            id: 'gad3',
            type: 'likert',
            label: 'Worrying too much about different things',
            required: true,
            options: gad7Likert,
            scoringKey: 'gad3',
          },
          {
            id: 'gad4',
            type: 'likert',
            label: 'Trouble relaxing',
            required: true,
            options: gad7Likert,
            scoringKey: 'gad4',
          },
          {
            id: 'gad5',
            type: 'likert',
            label: "Being so restless that it's hard to sit still",
            required: true,
            options: gad7Likert,
            scoringKey: 'gad5',
          },
          {
            id: 'gad6',
            type: 'likert',
            label: 'Becoming easily annoyed or irritable',
            required: true,
            options: gad7Likert,
            scoringKey: 'gad6',
          },
          {
            id: 'gad7',
            type: 'likert',
            label: 'Feeling afraid, as if something awful might happen',
            required: true,
            options: gad7Likert,
            scoringKey: 'gad7',
          },
        ],
      },
      scoringConfig: {
        maxScore: 21,
        ranges: [
          { min: 0, max: 4, severity: 'minimal' },
          { min: 5, max: 9, severity: 'mild' },
          { min: 10, max: 14, severity: 'moderate' },
          { min: 15, max: 21, severity: 'severe' },
        ],
      },
      isSystem: true,
      isPublished: true,
      version: 1,
    },
  });

  await prisma.worksheetTemplate.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {
      formSchema: {
        version: 1,
        description:
          'Daily mood tracking — quick check-in to record mood, emotions, and reflections.',
        fields: [
          {
            id: 'mood',
            type: 'rating',
            label: 'Overall mood today',
            helpText: '1 = very low, 10 = excellent',
            required: true,
            min: 1,
            max: 10,
          },
          {
            id: 'emotions',
            type: 'multi_select',
            label: 'Emotions felt today',
            options: [
              { value: 'happy', label: 'Happy' },
              { value: 'sad', label: 'Sad' },
              { value: 'anxious', label: 'Anxious' },
              { value: 'calm', label: 'Calm' },
              { value: 'angry', label: 'Angry' },
              { value: 'hopeful', label: 'Hopeful' },
              { value: 'lonely', label: 'Lonely' },
              { value: 'grateful', label: 'Grateful' },
              { value: 'overwhelmed', label: 'Overwhelmed' },
              { value: 'content', label: 'Content' },
            ],
          },
          {
            id: 'sleep',
            type: 'rating',
            label: 'Sleep quality last night',
            helpText: '1 = very poor, 10 = excellent',
            min: 1,
            max: 10,
          },
          {
            id: 'notes',
            type: 'textarea',
            label: 'Reflections or notes',
            helpText: 'Anything you want to capture about today.',
            rows: 5,
          },
        ],
      },
    },
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      title: 'Daily Mood Tracker',
      type: WorksheetType.MOOD_TRACKING,
      formSchema: {
        version: 1,
        description:
          'Daily mood tracking — quick check-in to record mood, emotions, and reflections.',
        fields: [
          {
            id: 'mood',
            type: 'rating',
            label: 'Overall mood today',
            helpText: '1 = very low, 10 = excellent',
            required: true,
            min: 1,
            max: 10,
          },
          {
            id: 'emotions',
            type: 'multi_select',
            label: 'Emotions felt today',
            options: [
              { value: 'happy', label: 'Happy' },
              { value: 'sad', label: 'Sad' },
              { value: 'anxious', label: 'Anxious' },
              { value: 'calm', label: 'Calm' },
              { value: 'angry', label: 'Angry' },
              { value: 'hopeful', label: 'Hopeful' },
              { value: 'lonely', label: 'Lonely' },
              { value: 'grateful', label: 'Grateful' },
              { value: 'overwhelmed', label: 'Overwhelmed' },
              { value: 'content', label: 'Content' },
            ],
          },
          {
            id: 'sleep',
            type: 'rating',
            label: 'Sleep quality last night',
            helpText: '1 = very poor, 10 = excellent',
            min: 1,
            max: 10,
          },
          {
            id: 'notes',
            type: 'textarea',
            label: 'Reflections or notes',
            helpText: 'Anything you want to capture about today.',
            rows: 5,
          },
        ],
      },
      scoringConfig: null,
      isSystem: true,
      isPublished: true,
      version: 1,
    },
  });

  console.log('Seed complete.');
  console.log(`  Users:      admin(1) + therapist(2) + client(3) = 6`);
  console.log(`  Templates:  ${3} system templates`);
  console.log(`  Relations:  therapist1 → client1, client2`);
  console.log('');
  console.log('Dev login credentials (password: Password123!):');
  console.log(`  admin@therapulse.dev`);
  console.log(`  therapist1@therapulse.dev  (approved)`);
  console.log(`  therapist2@therapulse.dev  (pending approval)`);
  console.log(`  client1@therapulse.dev`);
  console.log(`  client2@therapulse.dev`);
  console.log(`  client3@therapulse.dev`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
