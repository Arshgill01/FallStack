# Fallstack Reddit launch posts

Account: u/BrightyBrainiac. App: fallstack v0.0.39, approved and public. Home sub: r/fallstack.

## Round 2 (read this first)

Some of these were already posted on the old build (v0.0.39), which had a camera jolt on every landing, ledges cut off at the screen edge, and falls that didn't count after a zone change. v0.0.41 fixes all three and is live on r/fallstack now.

1. **Fill in the log at the bottom first.** Find every post already made from this file on u/BrightyBrainiac and add the sub, URL, and current score/comments.
2. **Don't repost in a sub you've already posted in.** Same text twice in one sub reads as spam and can get the account flagged. Instead, reply to your own post with comment R below. Also reply to anyone there who reported a bug, with one line saying it's fixed (if it actually is one of the three above).
3. **Subs not posted in yet:** carry on with the schedule below, one per day.
4. **Copy any feedback already in those threads** into the "Feedback collected" section.

### R. Update comment on posts that are already up

```
pushed a fix. landing used to jerk the camera, some ledges got cut off at the edge of the screen, and falls right after a new zone weren't counting. all three should be gone now. if you bounced off it earlier because of that, might be worth another go
```

## For whoever posts these (Codex)

Read this whole section before posting anything.

1. **Post the text as written.** Don't polish it, don't fix the lowercase, don't add headers, bold, emoji, or a closing line. The rough tone is on purpose. Only replace `[TODAY_POST]`.
2. **`[TODAY_POST]`** = the newest daily Fallstack post in r/fallstack at the moment you post (a new one goes up at 00:05 UTC). Open it first and confirm the game loads. If it doesn't load, stop and tell Arsh.
3. **Read each sub's rules and sidebar before posting.** If a rule needs something these drafts don't have (required flair, title format, video, self-promo day), adapt to the rule and note what you changed in the log below. If the sub doesn't allow this kind of post, skip it and log why.
4. **Stick to the schedule.** The same account posting the same game in four subs on one day gets caught by spam filters. Post between 13:00 and 16:00 UTC (6:30 to 9:30 pm IST), when US and EU are both awake.
5. **Stay with each post for the first hour.** Early replies matter more than anything else. Reply rules are at the bottom.
6. **Don't** crosspost, ask for upvotes, post from another account, or DM anyone who didn't ask.
7. **Log every post** in the table at the end: URL, time, then score, comments and the useful feedback at roughly 1h and 24h.

| Day | Where | Draft |
| --- | --- | --- |
| 1 | r/fallstack (then pin it) | A |
| 1 | r/Devvit | B |
| 2 | r/DestroyMyGame | C |
| 3 | r/playmygame | D |
| 4 | r/WebGames | E |
| ongoing | weekly feedback/self-promo threads in r/IndieGaming, r/indiegames, r/gamedev | F (as a comment) |
| Arsh only | modmail to subs that might install it | G |

---

## A. r/fallstack welcome post (pin it)

**Title:** what this place is

```
every day at midnight UTC a new tower goes up here. everyone climbs the same one.

when you fall, you leave something behind:

- fall short of a ledge and you leave a body. bodies pile up into footholds. six short falls on the same gap and somebody hammers in a nail.
- smack into a wall and you leave a ghost platform. you get one landing on it.
- overshoot and you leave a cursed brick. it crumbles.
- climb a section clean and it calms down. enough clean climbs and the cursed bricks turn back into footholds.

so the tower you climb tonight is made of everyone who fell off it this morning.

arrows to move, hold space to charge, let go to jump. on phone the buttons are at the bottom.

it's early and some stuff is broken. if something breaks, post it here with what phone or browser you're on. screenshots help a lot.

today's tower is the newest post. go fall off it.
```

---

## B. r/Devvit

Use the Showcase flair if it exists.

**Title:** made a daily climber where everyone's falls rebuild the tower. just got through app review

```
it's called Fallstack. one tower per day per sub, everybody climbs the same one, and every fall gets written back into it. short jumps pile up into footholds, wall smacks leave one-use ghost platforms, overshoots leave crumbling cursed bricks. clean climbs calm a section back down.

play it here: [TODAY_POST]

a few build notes in case anyone's doing something similar:

- phaser only loads in the expanded view. the inline post is a plain splash so the feed stays light
- redis stores counters per jump, not a list of falls. the client works out what to draw from the counts, so storage stays tiny no matter how many people fall
- realtime only sends a "something changed" ping. the client refetches and waits until you've landed before moving anything, so a ledge never shifts mid-jump
- the daily post is a scheduler job behind a redis SET NX lease, so the cron and the mod menu can't both post the same day

it's playable but rough, especially on phones. any feedback helps. and if you've grown a game past your own sub I'd really like to hear what worked for you.
```

---

## C. r/DestroyMyGame

This sub may require a video. If it does, record 20–40s of a phone playthrough that shows at least one fall and the thing it leaves behind, upload that as the post, and put the text below in the post body or as the first comment (whichever the rules say).

**Title:** every time someone falls in my game, the tower changes for everyone else. destroy it

```
it's a daily tower that runs inside reddit. everyone climbs the same one that day.

fall short of a ledge and your body stays there as a foothold for the next person. enough short falls on one gap turn into a nail people can actually stand on. hit a wall and you leave a ghost platform that holds you once. overshoot and you leave a cursed brick that crumbles. clean climbs fix things back up.

by the end of the day the tower is mostly other people's mistakes. resets at midnight UTC.

it's rough. I know about some of the bugs and there are parts I already want to rip out. I'd rather hear what's actually bad before I start.

arrows to move, hold space to charge, let go to jump. buttons on phone.

[TODAY_POST]

what I actually want to know:
- did the bodies and nails make sense or did they just look like clutter
- where did you quit
- does the jump feel good, floaty, stiff, what
```

---

## D. r/playmygame

Pick the Browser or Mobile flair if they have one.

**Title:** Fallstack: a daily tower that gets rebuilt by everyone who falls off it (free, browser + mobile)

```
free, runs in the browser or the reddit app, nothing to install.

one tower a day, same one for everybody. your falls stay in it: short jumps leave bodies that turn into footholds, wall hits leave one-use ghost platforms, overshoots leave cursed bricks that crumble. so every climb is a little different depending on who went before you.

arrows + hold space to jump on desktop, buttons on phone.

[TODAY_POST]

still early and a bit janky. tell me where it broke for you or where you gave up, that's the stuff I need most.
```

---

## E. r/WebGames

Check the rules first. They may only allow a direct link post with no body. If so, post the link with the title and put the body as the first comment.

**Title:** Fallstack: everyone climbs the same tower today, and every fall leaves something behind for the next person

```
new tower every day at midnight UTC. short falls pile up into footholds, wall hits leave ghost platforms, overshoots leave crumbling bricks. clean climbs fix things.

arrows to move, hold space and release to jump. works on phone too.

[TODAY_POST]
```

---

## F. Comment for weekly feedback / self-promo threads

```
Fallstack, a daily climbing game that runs on reddit. everyone climbs the same tower that day and every fall stays in it. short falls become footholds, wall hits become one-use ghost platforms, overshoots become cursed bricks. so the tower is basically built from everyone's mistakes.

[TODAY_POST]

it's rough. mostly want to know where people quit and whether the stuff left behind reads as help or clutter.
```

---

## G. Modmail to subs that might install it (Arsh sends these, not Codex)

Only to subs with 300+ weekly visitors where a daily game fits (gaming hangouts, small indie communities, anything with a daily-thread culture). At most a few a day. Change the first line for each sub so it doesn't read like a form letter.

**Subject:** a daily game for r/SUBNAME, if you want one

```
hey, I made a small daily climbing game that runs as a post inside a subreddit. new tower every day, everyone in the sub climbs the same one, and every fall leaves something in it. so by the end of the day the tower is shaped by your members.

it makes one post a day and doesn't do anything else in the sub. no ads, no tracking. it keeps the day's fall counts and checkpoints and clears them after three days.

here's what it looks like running: https://www.reddit.com/r/fallstack/
install page: https://developers.reddit.com/apps/fallstack

no worries if it's not a fit. if you try it and something's off, tell me and I'll fix it.
```

---

## Replying to comments

Ask Arsh before replying to anything that isn't a simple thanks or a bug question. When you do reply:

- Keep it short. One to three lines. Lowercase is fine.
- Answer the actual point. If it's a bug, ask what device or browser and roughly where in the tower.
- If they're right, say so plainly ("yeah that gap is unfair, fixing it"). Don't explain the design back at them and don't defend it.
- Don't promise dates.
- Never write: "great feedback", "thanks for taking the time", "I appreciate", "absolutely", "definitely", "that's a great point", "I hear you", "on the roadmap", "stay tuned", or em dashes. That's the stuff people clock as AI.

---

## Log

| Date (UTC) | Sub | Post URL | Score / comments at 1h | Score / comments at 24h | Rule changes made |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

### Feedback collected

Keep each line short: who said it (sub only, no usernames), what they said, device if known.

**Bugs**

**Confusion (what people didn't get)**

**Feel (jump, controls, difficulty)**

**What people liked**
