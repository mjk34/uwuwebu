export type MockUser = {
  discordId: string;
  username: string;
  avatarUrl: string;
  creds: number;
  level: number;
  xp: number;
  rolls: number;
  dailyCount: number;
  tickets: number;
};

export const mockUsers: MockUser[] = [
  {
    discordId: "221368188217065475",
    username: "mjk",
    avatarUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
    creds: 12480,
    level: 42,
    xp: 8920,
    rolls: 17,
    dailyCount: 183,
    tickets: 5,
  },
  {
    discordId: "304010830963376129",
    username: "testfriend",
    avatarUrl: "https://cdn.discordapp.com/embed/avatars/1.png",
    creds: 3210,
    level: 18,
    xp: 2104,
    rolls: 4,
    dailyCount: 47,
    tickets: 1,
  },
  {
    discordId: "112233445566778899",
    username: "broke_user",
    avatarUrl: "https://cdn.discordapp.com/embed/avatars/2.png",
    creds: -120,
    level: 3,
    xp: 88,
    rolls: 0,
    dailyCount: 2,
    tickets: 0,
  },
];

export const mockCurrentUser: MockUser = mockUsers[0];

export function getMockUser(discordId: string): MockUser | undefined {
  return mockUsers.find((u) => u.discordId === discordId);
}

export type MockGameDemo = {
  id: string;
  code: string;
  title: string;
  tagline: string;
  heroSrc: string;
};

export const mockGameDemos: MockGameDemo[] = [
  {
    id: "cred-rush",
    code: "DEMO.001",
    title: "CRED RUSH",
    tagline: "High-velocity market runner. Scalp the orderbook, cash out clean.",
    heroSrc: "/demos/demo-1.svg",
  },
  {
    id: "clip-oracle",
    code: "DEMO.002",
    title: "CLIP ORACLE",
    tagline: "Rate the reels. Train the oracle. Rise through the ranks.",
    heroSrc: "/demos/demo-2.svg",
  },
  {
    id: "hysa-heist",
    code: "DEMO.003",
    title: "HYSA HEIST",
    tagline: "Crack the vault, duck the audit, bank before the rate hike.",
    heroSrc: "/demos/demo-3.svg",
  },
];
