import { reddit } from '@devvit/web/server';

export const createPost = async () => {
  return await reddit.submitCustomPost({
    title: "Fallstack: today's tower has failed climbs in it",
  });
};
