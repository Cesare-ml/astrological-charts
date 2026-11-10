/** Paths for the original latitude symbols, shared across compatible skins. */
export function latitudePlanetAsset(theme: string, name: string, transit: boolean): string {
  // The source artwork uses a lowercase "node" for this one asset on all platforms.
  const fileName = name === 'true Node' ? 'true node' : name;
  const baseTheme = theme === 'dark' || theme === 'dark-bn' ? 'dark'
    : theme === 'astrolabio' || theme === 'astrolabio-girasole' ? 'astrolabio' : 'light';
  if (transit) {
    // Transit markers have a separate outlined ring in the original artwork.
    return `simboli/elementi-celesti/${baseTheme}/cerchio/anello/${fileName}.png`;
  }
  const circleTheme = baseTheme === 'dark' ? 'dark' : 'light';
  return `symbols/planets/${circleTheme}/_circle/${fileName}.png`;
}
