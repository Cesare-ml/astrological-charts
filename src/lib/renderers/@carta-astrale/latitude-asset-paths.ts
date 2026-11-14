/** Paths for the original latitude symbols, shared across compatible skins. */
export function latitudePlanetAsset(theme: string, name: string, transit: boolean): string {
  // Planet identifiers come from chart input. Never allow one to escape the
  // selected artwork directory or become a URL query/fragment.
  if (typeof name !== 'string' || !name.trim() || name !== name.trim()
      || name === '.' || name === '..' || /[\\/%?#:\u0000-\u001f\u007f]/.test(name)) {
    throw new TypeError('Latitude symbol name must be a valid asset filename stem.');
  }

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
