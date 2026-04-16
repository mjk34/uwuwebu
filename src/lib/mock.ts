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
    discordId: "000000000000000001",
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
    discordId: "000000000000000002",
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

