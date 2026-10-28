import { ScriptDocument, TeleprompterSettings } from '../types/teleprompter';

export const DEFAULT_SETTINGS: TeleprompterSettings = {
  wpm: 130,
  fontSize: 48,
  lineHeight: 1.55,
  contentWidthPercent: 68,
  fontFamily: 'sans',
  textAlign: 'left',
  mirrorHorizontal: false,
  mirrorVertical: false,
  showReadingGuide: true,
  readingGuidePosition: 36,
  dimSurroundingText: true,
  countdownSeconds: 3,
  honorPauseCues: true,
  autoLoop: false,
  prompterTheme: 'pitch-black',
  editorFontSize: 18,
};

export const STARTER_SCRIPTS: ScriptDocument[] = [
  {
    id: 'keynote-product-launch',
    title: 'Keynote: Designing for Calm Focus',
    category: 'Keynote Speech',
    updatedAt: Date.now() - 1000 * 60 * 15,
    content: `# Opening Hook

Good morning everyone. Take a breath and think about the tools you opened before walking into this room today.

[PAUSE 2s]

Most software competes for your peripheral vision. Badges, tickers, floating toolbars, and endless notifications pull your focus away from the actual craft of thinking and speaking clearly.

# The Core Principle

When we started building our new studio workflow, we asked a simple question: What happens when an interface steps out of the way?

[SLOW]

Clarity is not the absence of capability. Clarity is the deliberate arrangement of only what matters right now.

[PAUSE 2s]

# Three Pillars of Delivery

First, establish a natural cadence. When your script breathes with comfortable margins and generous line spacing, your voice naturally drops into a calm, authoritative register.

Second, anchor your eye-line. By keeping your active reading zone positioned near the top third of your screen, right below your camera lens, your audience feels direct, unbroken connection.

Third, respect the pause. Silence after a key insight gives your listeners time to absorb what you just shared.

[PAUSE 3s]

# Closing Call to Action

Thank you for spending these few minutes with us today. Let's build work that speaks with quiet confidence.`
  },
  {
    id: 'youtube-creator-essay',
    title: 'Video Essay: The Art of Pacing',
    category: 'Video Production',
    updatedAt: Date.now() - 1000 * 60 * 120,
    content: `# Cold Open (Camera A - Close Up)

Have you ever watched a ten-minute video that felt like two minutes—and then watched a two-minute clip that felt like an eternity?

[PAUSE 2s]

The secret isn't faster editing or louder sound effects. It comes down to conversational pacing and intentional rhythm.

# Section 1: The Rhythm of Natural Speech

When we speak off the cuff, we naturally vary our tempo. We speed up slightly when building momentum through a story, and we slow down when delivering the takeaway.

[SLOW]

When reading from a screen, most creators lock into a robotic monotone because the text scrolls like a relentless conveyor belt.

[PAUSE 2s]

# Section 2: Practical Studio Habits

Place your teleprompter window as close to your lens as possible. Soften your shoulders, speak to a single person rather than a crowd, and treat every paragraph break as a moment to reset your breath.

If you found this breakdown helpful, share it with a fellow creator who is refining their on-camera presence. See you in the next film.`
  },
  {
    id: 'interview-executive-pitch',
    title: 'Executive Briefing & Q&A Intro',
    category: 'Interview & Pitch',
    updatedAt: Date.now() - 1000 * 60 * 360,
    content: `# Introduction & Context

Thank you for having me. Over the past four years, my focus has been leading cross-functional product teams from initial architecture through global launch.

[PAUSE 2s]

# Key Outcome Highlight

In our most recent release cycle, we simplified our onboarding pipeline by removing four redundant configuration steps. Within sixty days, completion rates rose by thirty-four percent while support volume dropped by nearly half.

[SLOW]

# Looking Ahead

What excites me most about this role is the opportunity to bring that same disciplined, user-first execution to your core platform. I would love to dive into how we can approach the upcoming Q3 roadmap together.`
  },
  {
    id: 'academic-lecture-intro',
    title: 'Seminar: Systems & Architecture',
    category: 'Lecture & Class',
    updatedAt: Date.now() - 1000 * 60 * 1440,
    content: `# Welcome to Week Four

Welcome back everyone. Today we are transitioning from theoretical models into real-world systems architecture.

[PAUSE 2s]

# Key Question for Today

As you review today's case study, keep one question at the top of your notebook: Where does complexity live when a system scales by two orders of magnitude?

[SLOW]

We will examine three historical engineering trade-offs, analyze where bottlenecks emerged, and then break into small design groups for the final twenty minutes.`
  }
];
