// Mirror of frontend getAttractionPreferences for discover filtering
type GenderIdentity = 'male' | 'female' | 'non-binary' | 'other';
type Orientation = string;
type AttractionPreference = 'women' | 'men' | 'non-binary' | 'all-genders';

export function getAttractionPreferences(
  genderIdentity: GenderIdentity | null | undefined,
  orientation: Orientation | null | undefined
): AttractionPreference[] {
  if (!genderIdentity || !orientation) return ['all-genders'];

  const normalizedOrientation = !['heterosexual', 'homosexual', 'bisexual', 'asexual', 'pansexual', 'queer'].includes(orientation)
    ? 'other' : orientation;

  switch (normalizedOrientation) {
    case 'heterosexual':
      if (genderIdentity === 'male') return ['women'];
      if (genderIdentity === 'female') return ['men'];
      return ['all-genders'];
    case 'homosexual':
      if (genderIdentity === 'male') return ['men'];
      if (genderIdentity === 'female') return ['women'];
      if (genderIdentity === 'non-binary') return ['non-binary'];
      return ['all-genders'];
    case 'bisexual':
      return ['women', 'men'];
    case 'pansexual':
    case 'queer':
      return ['all-genders'];
    case 'asexual':
      return [];
    default:
      return ['all-genders'];
  }
}

export function isCompatible(
  myGender: string | null | undefined,
  myOrientation: string | null | undefined,
  myLookingRelationship: boolean,
  myLookingFriendship: boolean,
  theirGender: string | null | undefined,
  theirOrientation: string | null | undefined,
  theirLookingRelationship: boolean,
  theirLookingFriendship: boolean
): boolean {
  const wantsRelationship = myLookingRelationship;
  const wantsFriendship = myLookingFriendship;
  if (!wantsRelationship && !wantsFriendship) return false;

  const theyWantRelationship = theirLookingRelationship;
  const theyWantFriendship = theirLookingFriendship;
  if (!theyWantRelationship && !theyWantFriendship) return false;

  if (wantsRelationship && !wantsFriendship && !theyWantRelationship) return false;
  if (wantsFriendship && !wantsRelationship && !theyWantFriendship) return false;

  if (wantsRelationship && theyWantRelationship && myGender && myOrientation && theirGender && theirOrientation) {
    const myPrefs = getAttractionPreferences(myGender as any, myOrientation);
    const theirPrefs = getAttractionPreferences(theirGender as any, theirOrientation);
    const iLikeThem = myPrefs.includes('all-genders') ||
      (theirGender === 'female' && myPrefs.includes('women')) ||
      (theirGender === 'male' && myPrefs.includes('men')) ||
      (theirGender === 'non-binary' && myPrefs.includes('non-binary'));
    const theyLikeMe = theirPrefs.includes('all-genders') ||
      (myGender === 'female' && theirPrefs.includes('women')) ||
      (myGender === 'male' && theirPrefs.includes('men')) ||
      (myGender === 'non-binary' && theirPrefs.includes('non-binary'));
    if (myPrefs.length > 0 && theirPrefs.length > 0 && (!iLikeThem || !theyLikeMe)) return false;
  }
  return true;
}
