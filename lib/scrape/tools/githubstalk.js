import axios from "axios";

export async function githubstalk(user) {
  try {
    const { data } = await axios.get(`https://api.github.com/users/${user}`);
    return {
      success: true,
      username: data.login,
      nickname: data.name,
      bio: data.bio,
      profile_pic: data.avatar_url,
      url: data.html_url,
      company: data.company,
      blog: data.blog,
      location: data.location,
      public_repos: data.public_repos,
      followers: data.followers,
      following: data.following,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}