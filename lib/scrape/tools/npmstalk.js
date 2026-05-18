import axios from "axios";

export async function npmstalk(packageName) {
  try {
    const { data } = await axios.get(`https://registry.npmjs.org/${packageName}`);
    const versions = data.versions;
    const allver = Object.keys(versions);
    const verLatest = allver[allver.length - 1];
    const verPublish = allver[0];
    const packageLatest = versions[verLatest];
    return {
      success: true,
      name: packageName,
      versionLatest: verLatest,
      versionPublish: verPublish,
      versionCount: allver.length,
      latestDeps: Object.keys(packageLatest.dependencies || {}).length,
      publishDeps: Object.keys(versions[verPublish]?.dependencies || {}).length,
      created: data.time.created,
      updated: data.time[verLatest],
      description: data.description || "-"
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}