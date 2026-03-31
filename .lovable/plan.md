

# Lower Profile Completeness Threshold from 100% to 90%

## Problem

The `isProfileComplete()` function requires **every** required field to be filled (100%). Users at 91% are blocked from requesting access, even though optional "about me" fields aren't meaningful for deal qualification.

## Change — Single File

**`src/lib/profile-completeness.ts`** (line 59-60)

Change `isProfileComplete` from checking for zero missing fields to checking if completion percentage ≥ 90%:

```ts
export const isProfileComplete = (user: Partial<User>): boolean => {
  return getProfileCompletionPercentage(user) >= 90;
};
```

That's it. Every consumer (`ConnectionButton`, `ListingCard`, `ListingCardActions`, `ProfileForm`) already calls this function — they all inherit the new threshold automatically.

