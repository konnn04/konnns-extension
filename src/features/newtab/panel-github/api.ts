/**
 * GitHub via Personal Access Token (docs/phase-3 §2 — recommended for the first
 * version; no OAuth app registration needed). Token is stored in the feature's
 * settings (secret field) and never leaves the browser except to api.github.com.
 */

export interface ContribDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface RecentRepo {
  name: string;
  description: string | null;
  url: string;
  stars: number;
  language: string | null;
  pushedAt: number;
}

export interface GitHubProfile {
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  followers: number;
  following: number;
  repos: number;
  totalContributions: number;
  weeks: ContribDay[][];
  recentRepos: RecentRepo[];
}

const GQL = `query {
  viewer {
    login name avatarUrl bio
    followers { totalCount }
    following { totalCount }
    repositories { totalCount }
    recentRepos: repositories(first: 5, orderBy: {field: PUSHED_AT, direction: DESC}) {
      nodes { name description url stargazerCount pushedAt primaryLanguage { name } }
    }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

function levelFor(count: number): ContribDay["level"] {
  if (count === 0) return 0;
  if (count < 3) return 1;
  if (count < 6) return 2;
  if (count < 10) return 3;
  return 4;
}

export async function fetchProfile(token: string): Promise<GitHubProfile> {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: GQL }),
  });
  if (!res.ok) throw new Error(`github ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error("github graphql error");
  const v = json.data.viewer;
  const cal = v.contributionsCollection.contributionCalendar;

  return {
    login: v.login,
    name: v.name,
    avatarUrl: v.avatarUrl,
    bio: v.bio,
    followers: v.followers.totalCount,
    following: v.following.totalCount,
    repos: v.repositories.totalCount,
    totalContributions: cal.totalContributions,
    weeks: cal.weeks.map((w: { contributionDays: { date: string; contributionCount: number }[] }) =>
      w.contributionDays.map((d) => ({
        date: d.date,
        count: d.contributionCount,
        level: levelFor(d.contributionCount),
      })),
    ),
    recentRepos: (v.recentRepos?.nodes ?? []).map(
      (r: {
        name: string;
        description: string | null;
        url: string;
        stargazerCount: number;
        pushedAt: string;
        primaryLanguage: { name: string } | null;
      }): RecentRepo => ({
        name: r.name,
        description: r.description,
        url: r.url,
        stars: r.stargazerCount,
        language: r.primaryLanguage?.name ?? null,
        pushedAt: new Date(r.pushedAt).getTime(),
      }),
    ),
  };
}

export interface GitHubNotification {
  id: string;
  title: string;
  repo: string;
  reason: string;
  url: string;
}

export type TrendingWindow = "day" | "week" | "month";

export interface TrendingRepo {
  name: string;
  url: string;
  stars: number;
  language: string | null;
  description: string | null;
}

/** Approximate "trending" via the search API: repos created in the window,
 * sorted by stars. Optional feature (docs item 10). */
export async function fetchTrending(
  token: string,
  window: TrendingWindow,
): Promise<TrendingRepo[]> {
  const days = window === "day" ? 1 : window === "week" ? 7 : 30;
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const q = encodeURIComponent(`created:>=${since}`);
  const res = await fetch(
    `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=6`,
    { headers: { Authorization: `bearer ${token}`, Accept: "application/vnd.github+json" } },
  );
  if (!res.ok) return [];
  const json = await res.json();
  return (json.items ?? []).map(
    (r: {
      full_name: string;
      html_url: string;
      stargazers_count: number;
      language: string | null;
      description: string | null;
    }): TrendingRepo => ({
      name: r.full_name,
      url: r.html_url,
      stars: r.stargazers_count,
      language: r.language,
      description: r.description,
    }),
  );
}

/** Recent notifications with detail (needs the `notifications` scope). */
export async function fetchNotifications(token: string): Promise<GitHubNotification[]> {
  const res = await fetch("https://api.github.com/notifications?per_page=8", {
    headers: { Authorization: `bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) return [];
  const list = await res.json();
  if (!Array.isArray(list)) return [];
  return list.map(
    (n: {
      id: string;
      reason: string;
      subject: { title: string };
      repository: { full_name: string; html_url: string };
    }): GitHubNotification => ({
      id: n.id,
      title: n.subject.title,
      repo: n.repository.full_name,
      reason: n.reason,
      url: n.repository.html_url,
    }),
  );
}

/** Count of unread GitHub notifications (needs the `notifications` scope). */
export async function fetchUnreadCount(token: string): Promise<number> {
  const res = await fetch("https://api.github.com/notifications?per_page=50", {
    headers: { Authorization: `bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) return 0;
  const list = await res.json();
  return Array.isArray(list) ? list.length : 0;
}
