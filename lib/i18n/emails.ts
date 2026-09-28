import type { Language } from "./messages";

type PollLinks = { question: string; pollLink: string; ownerLink: string };

// Email wording, kept apart from `messages` because it is built from functions.
export const emails: Record<
  Language,
  {
    created: (p: PollLinks) => { subject: string; text: string };
    recovery: (polls: PollLinks[]) => { subject: string; text: string };
  }
> = {
  ko: {
    created: ({ question, pollLink, ownerLink }) => ({
      subject: `투표가 만들어졌습니다: ${question}`,
      text: [
        `"${question}" 투표가 만들어졌습니다.`,
        "",
        `투표 링크 (참여자에게 공유하세요): ${pollLink}`,
        `관리 링크 (비밀로 보관하세요): ${ownerLink}`,
        "",
        "관리 링크가 있으면 누구나 이 투표를 마감, 다시 열기, 삭제할 수 있습니다.",
      ].join("\n"),
    }),
    recovery: (polls) => ({
      subject: "투표 관리 링크",
      text: [
        "요청하신 투표 관리 링크입니다.",
        "",
        ...polls.flatMap((p) => [`• ${p.question}`, `  관리 링크: ${p.ownerLink}`, `  투표 링크: ${p.pollLink}`]),
        "",
        "요청하지 않으셨다면 이 메일을 무시하세요.",
      ].join("\n"),
    }),
  },
};
