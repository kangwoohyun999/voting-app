// All app wording. Poll questions and Options are never translated.
export const messages = {
  ko: {
    appName: "투표",
    createTitle: "새 투표 만들기",
    question: "질문",
    questionPlaceholder: "예: 금요일 점심 뭐 먹을까?",
    options: "선택지",
    optionPlaceholder: "선택지",
    addOption: "선택지 추가",
    removeOption: "삭제",
    ownerEmail: "이메일 (관리 링크 복구용, 공개되지 않음)",
    create: "투표 만들기",
    creating: "만드는 중…",
    ownerEmailRequired: "이메일을 입력해 주세요.",
    created: "투표가 만들어졌습니다",
    pollLinkLabel: "투표 링크 — 참여자에게 공유하세요",
    ownerLinkLabel: "관리 링크 — 비밀로 보관하세요",
    notFound: "투표를 찾을 수 없습니다.",
    vote: "투표하기",
    switchVote: "선택 바꾸기",
    yourVote: "내 선택",
    results: "결과",
    votes: "표",
    resultsAfterVoting: "투표하면 결과를 볼 수 있습니다.",
    noOptions: "이 투표에는 선택지가 없어 투표할 수 없습니다.",
    backHome: "처음으로",
  },
} as const;

export type Language = keyof typeof messages;
export type Messages = (typeof messages)[Language];
