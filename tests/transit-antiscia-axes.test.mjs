import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Executes the actual TypeScript renderer against synthetic geometry, not screenshots.
const source = readFileSync(
  new URL('../src/lib/renderers/moduli/transiti.renderer.ts', import.meta.url), 'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

// The consolidated renderer imports the actual color helper; evaluate it
// rather than treating the import as an unknown dependency.
const helperSource = readFileSync(
  new URL('../src/lib/renderers/antisci-marker-color.ts', import.meta.url), 'utf8',
);
const helperCompiled = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helperExports = {};
vm.runInNewContext(helperCompiled, { exports: helperExports });
const { getAntisciMarkerColor } = helperExports;

function createHarness(longitude = 10, { failOnCelestial = false } = {}) {
  const objects = [];
  let celestialCalls = 0;
  const ringCalls = [];
  class Group {
    children = [];
    add(child) { this.children.push(child); }
  }
  class Vector3 {
    constructor(x, y, z) {
      Object.assign(this, { x, y, z });
    }
  }
  const object = (kind, other = {}) => {
    const result = {
      kind, position: new Vector3(0, 0, 0), rotation: { z: 0 },
      rotateZ(angle) { this.rotation.z = angle; },
      translateY(distance) {
        this.position.x = -Math.sin(this.rotation.z) * distance;
        this.position.y = Math.cos(this.rotation.z) * distance;
      },
      ...other,
    };
    objects.push(result);
    return result;
  };
  const primitives = {
    getLineaGrossa(start, end, color, width) {
      return object('thick-line', { start, end, color, width });
    },
    getLineaGrossaTratteggiata(start, end, color, width, spacing) {
      return object('dashed-line', { start, end, color, width, spacing });
    },
    getCerchio(radius, color) { return object('circle', { radius, color }); },
  };
  const dependencies = {
    three: { Group, Vector3, MathUtils: { degToRad: value => value * Math.PI / 180 } },
    '../oggetti-semplici.renderer': { OggettiSempliciRender: primitives },
    './elementi-celesti.renderer': {
      ElementiCelestiRender: {
        async getElementiCelesti() {
          celestialCalls++;
          if (failOnCelestial) throw new Error('Celestial computation must be skipped');
          return { Sun: { longitude } };
        },
        async getAnelloElementiCelesti(...args) {
          ringCalls.push(args);
          return { kind: 'planet-ring' };
        },
      },
    },
    '../_colori.config': { Colori: { elementiCelesti: { Sun: '#ffcc00' } } },
    '../@skin-manager': { SkinManager: { skins: { light: { bgColor: '#fefefe', anelloTransiti: { texture: null } } } } },
    '../antisci-marker-color': { getAntisciMarkerColor },
  };
  const context = {
    exports: {},
    require(specifier) {
      assert.ok(Object.hasOwn(dependencies, specifier), 'Unexpected import: ' + specifier);
      return dependencies[specifier];
    },
  };
  vm.runInNewContext(compiled, context, { filename: 'transiti.renderer.js' });
  return { TransitiRender: context.exports.TransitiRender, objects, getCelestialCalls: () => celestialCalls, ringCalls };
}
const axisPositions = {
  Cardinale: 270,
  Fissa: 300,
  Mutevole: 330,
};

function isFiniteObject(object) {
  const coordinates = [object.position.x, object.position.y, object.position.z, object.rotation.z];
  if (object.start) coordinates.push(object.start.x, object.start.y, object.start.z);
  if (object.end) coordinates.push(object.end.x, object.end.y, object.end.z);
  return coordinates.every(Number.isFinite);
}

async function render(options, longitude = 10, harnessOptions = {}) {
  const h = createHarness(longitude, harnessOptions);
  const theme = Object.hasOwn(harnessOptions, 'theme')
    ? harnessOptions.theme
    : { planets: { Sun: { longitude } } };
  const group = await h.TransitiRender.getAntisci(
    theme, 90, { settaggi: { skin_id: 'light' }, ...options },
    4, 4, 5, 6,
  );
  return { ...h, group };
}

test('all three supported antiscia axes retain their angular placement', async () => {
  const result = await render({ antisci: { Cardinale: true, Fissa: true, Mutevole: true } });
  assert.equal(result.group.children.length, 3);
  assert.equal(result.objects.length, 3);
  for (const [index, longitude] of Object.values(axisPositions).entries()) {
    const axis = result.group.children[index];
    assert.equal(axis.kind, 'thick-line');
    assert.ok(Math.abs(axis.rotation.z - longitude * Math.PI / 180) < 1e-12);
  }
  assert.ok(result.objects.every(isFiniteObject));
});

test('unknown and inherited antiscia keys cannot create NaN geometry', async () => {
  const antisci = Object.assign(Object.create({ Inherited: true }), {
    Cardinale: true,
    InvalidAxis: true,
  });
  const result = await render({ antisci, antisciTransitiHover: { nome: 'Sun' } });
  assert.equal(result.group.children.length, 8);
  assert.equal(result.objects.filter(x => x.kind === 'thick-line').length, 4);
  assert.equal(result.objects.filter(x => x.kind === 'circle').length, 3);
  assert.equal(result.objects.filter(x => x.kind === 'dashed-line').length, 1);
  assert.ok(result.objects.every(isFiniteObject));
});

test('only recognized enabled axes render, even when unknown keys are truthy', async () => {
  const result = await render({
    antisci: { Cardinale: false, Fissa: false, Mutevole: false, Unexpected: true },
    antisciTransitiHover: { nome: 'Sun' },
  });
  assert.equal(result.group.children.length, 0);
  assert.equal(result.objects.length, 0);
});

test('hovering an unavailable planet draws axes but no triangular relation', async () => {
  const result = await render({
    antisci: { Cardinale: true, Unknown: true },
    antisciTransitiHover: { nome: 'NoPlanet' },
  });
  assert.equal(result.group.children.length, 1);
  assert.equal(result.objects.length, 1);
});

test('inherited recognized axis flags are ignored unless explicitly owned', async () => {
  const inherited = Object.create({ Cardinale: true, Mutevole: true });
  inherited.Fissa = true;
  const result = await render({ antisci: inherited, antisciTransitiHover: { nome: 'Sun' } });
  assert.equal(result.group.children.length, 8, 'only the owned Fissa axis and its hover links');
  const axis = result.group.children[0];
  assert.equal(axis.kind, 'thick-line');
  assert.ok(Math.abs(axis.rotation.z - Math.PI * 5 / 3) < 1e-12);
  assert.ok(result.objects.every(isFiniteObject));
});

test('missing and null antiscia option maps are empty, not exceptions', async () => {
  for (const antisci of [undefined, null]) {
    const result = await render({ antisci, antisciTransitiHover: { nome: 'Sun' } });
    assert.equal(result.group.children.length, 0);
    assert.equal(result.objects.length, 0);
  }
});

test('invalid hovered longitudes retain the valid axis but never draw NaN relations', async () => {
  for (const longitude of [NaN, Infinity, -Infinity, null, '10']) {
    const result = await render({
      antisci: { Cardinale: true }, antisciTransitiHover: { nome: 'Sun' },
    }, longitude);
    assert.equal(result.group.children.length, 1, `invalid longitude: ${String(longitude)}`);
    assert.equal(result.objects.filter((x) => x.kind === 'circle').length, 0);
    assert.equal(result.objects.filter((x) => x.kind === 'dashed-line').length, 0);
    assert.ok(result.objects.every(isFiniteObject));
  }
});

test('a real planet at zero degrees still renders all hover markers and links', async () => {
  const result = await render({
    antisci: { Cardinale: true }, antisciTransitiHover: { nome: 'Sun' },
  }, 0);
  assert.equal(result.group.children.length, 8);
  assert.equal(result.objects.filter((x) => x.kind === 'circle').length, 3);
  assert.ok(result.objects.every(isFiniteObject));
});

test('axes render without resolving planet data when no hover was requested', async () => {
  const result = await render({
    antisci: { Cardinale: true, Fissa: true, Mutevole: true },
  }, 10, { failOnCelestial: true });
  assert.equal(result.group.children.length, 3);
  assert.equal(result.getCelestialCalls(), 0);
  assert.ok(result.objects.every(isFiniteObject));
});

test('unknown-only, disabled or absent axes skip planet lookup even with hover', async () => {
  for (const antisci of [
    { Unknown: true },
    { Cardinale: false, Fissa: false, Mutevole: false },
    undefined,
    null,
  ]) {
    const result = await render({
      antisci,
      antisciTransitiHover: { nome: 'Sun' },
    }, 10, { failOnCelestial: true });
    assert.equal(result.group.children.length, 0);
    assert.equal(result.getCelestialCalls(), 0);
    assert.equal(result.objects.length, 0);
  }
});

test('an explicit planet hover resolves data exactly once for three enabled axes', async () => {
  const result = await render({
    antisci: { Cardinale: true, Fissa: true, Mutevole: true },
    antisciTransitiHover: { nome: 'Sun' },
  });
  assert.equal(result.getCelestialCalls(), 1);
  assert.equal(result.group.children.length, 24, 'three axes and seven hover objects per axis');
  assert.equal(result.objects.filter(x => x.kind === 'circle').length, 9);
  assert.ok(result.objects.every(isFiniteObject));
});

test('empty hover name does not request celestial data or draw hover relations', async () => {
  const result = await render({
    antisci: { Cardinale: true },
    antisciTransitiHover: { nome: '' },
  }, 10, { failOnCelestial: true });
  assert.equal(result.group.children.length, 1);
  assert.equal(result.getCelestialCalls(), 0);
});

test('active axes remain visible when hovered theme planets have not loaded', async () => {
  for (const theme of [
    {}, { planets: undefined }, { planets: null }, null,
  ]) {
    const result = await render({
      antisci: { Cardinale: true, Fissa: true },
      antisciTransitiHover: { nome: 'Sun' },
    }, 10, { theme, failOnCelestial: true });
    assert.equal(result.group.children.length, 2, 'only the supported axis lines');
    assert.equal(result.getCelestialCalls(), 0, 'do not clone an unavailable planet map');
    assert.equal(result.objects.filter(x => x.kind === 'circle').length, 0);
    assert.ok(result.objects.every(isFiniteObject));
  }
});

test('transit ring skips antiscia geometry when the feature toggle is off', async () => {
  const h = createHarness(18, { failOnCelestial: true });
  const options = {
    settaggi: { skin_id: 'light' },
    mostraAntisci: false,
    antisci: { Cardinale: true, Fissa: true },
    antisciTransitiHover: { nome: 'Sun' },
  };
  const chart = await h.TransitiRender.getAnelloTransiti(
    { planets: { Sun: { longitude: 18 } }, australInversion: false },
    90, ['Sun'], options, 4, 6, 3, false,
  );
  assert.equal(chart.children.length, 1);
  assert.equal(chart.children[0].kind, 'planet-ring');
  assert.equal(h.ringCalls.length, 1, 'the celestial transit ring remains rendered');
  assert.equal(h.getCelestialCalls(), 0, 'no antiscia hover work when the feature is off');
});

test('transit ring retains enabled antiscia axes while planet data is loading', async () => {
  const h = createHarness(18, { failOnCelestial: true });
  const chart = await h.TransitiRender.getAnelloTransiti(
    { australInversion: false },
    90, [], {
      settaggi: { skin_id: 'light' }, mostraAntisci: true,
      antisci: { Cardinale: true, Fissa: true },
      antisciTransitiHover: { nome: 'Sun' },
    }, 4, 6, 3, false,
  );
  assert.equal(chart.children.length, 2);
  assert.equal(chart.children[0].kind, 'planet-ring');
  assert.equal(chart.children[1].children.length, 2, 'only two valid axis lines');
  assert.equal(h.ringCalls.length, 1);
  assert.equal(h.getCelestialCalls(), 0);
  assert.ok(h.objects.every(isFiniteObject));
});

test('transit ring enables a single finite hover lookup for all three axes', async () => {
  const h = createHarness(0);
  const chart = await h.TransitiRender.getAnelloTransiti(
    { planets: { Sun: { longitude: 0 } }, australInversion: false },
    90, ['Sun'], {
      settaggi: { skin_id: 'light' }, mostraAntisci: true,
      antisci: { Cardinale: true, Fissa: true, Mutevole: true },
      antisciTransitiHover: { nome: 'Sun' },
    }, 4, 6, 3, false,
  );
  assert.equal(chart.children.length, 2);
  assert.equal(chart.children[1].children.length, 24, '3 axes with 7 hover objects per axis');
  assert.equal(h.getCelestialCalls(), 1);
  assert.equal(h.objects.filter(x => x.kind === 'circle').length, 9);
  assert.ok(h.objects.every(isFiniteObject));
});

test('nonfinite ascendant skips the entire antiscia overlay, not NaN rotations', async () => {
  for (const ascendant of [NaN, Infinity, -Infinity, undefined]) {
    const h = createHarness(10, { failOnCelestial: true });
    const chart = await h.TransitiRender.getAntisci({}, ascendant, {
      settaggi: { skin_id: 'light' }, antisci: { Cardinale: true },
      antisciTransitiHover: { nome: 'Sun' },
    }, 4, 4, 5, 6);
    assert.equal(chart.children.length, 0);
    assert.equal(h.getCelestialCalls(), 0);
    assert.equal(h.objects.length, 0);
  }
});

test('nonfinite zodiac ring diameters skip invalid antiscia axis endpoints', async () => {
  for (const diameter of [NaN, Infinity, -Infinity, undefined]) {
    const h = createHarness(10, { failOnCelestial: true });
    const chart = await h.TransitiRender.getAntisci({}, 90, {
      settaggi: { skin_id: 'light' }, antisci: { Cardinale: true },
      antisciTransitiHover: { nome: 'Sun' },
    }, 4, diameter, 5, 6);
    assert.equal(chart.children.length, 0);
    assert.equal(h.getCelestialCalls(), 0);
    assert.equal(h.objects.length, 0);
  }
});

test('nonfinite inner ring diameters retain finite axes but skip hover markers', async () => {
  for (const diameter of [NaN, Infinity, -Infinity, undefined]) {
    const h = createHarness(10);
    const chart = await h.TransitiRender.getAntisci(
      { planets: { Sun: { longitude: 10 } } }, 90, {
        settaggi: { skin_id: 'light' }, antisci: { Cardinale: true },
        antisciTransitiHover: { nome: 'Sun' },
      }, diameter, 4, 5, 6,
    );
    assert.equal(chart.children.length, 1);
    assert.equal(h.objects.filter(x => x.kind === 'circle').length, 0);
    assert.ok(h.objects.every(isFiniteObject));
  }
});

test('cardinal antiscia and contra-antiscia have exact mirrored angles and linked endpoints', async () => {
  const result = await render({
    antisci: { Cardinale: true }, antisciTransitiHover: { nome: 'Sun' },
  }, 10);
  const [axis, planet, antiscia, contra, triangle1, triangle2, triangle3, contraLine] = result.group.children;
  const toRad = degrees => degrees * Math.PI / 180;
  const near = (actual, expected, label) =>
    assert.ok(Math.abs(actual - expected) < 1e-12, `${label}: ${actual} != ${expected}`);

  near(axis.rotation.z, toRad(270), 'cardinal axis');
  near(planet.rotation.z, toRad(10), 'planet longitude');
  near(antiscia.rotation.z, toRad(530), 'antiscia longitude (2×270° − 10°)');
  near(contra.rotation.z, toRad(710), 'contra-antiscia longitude (+180°)');
  for (const [name, circle, angle] of [
    ['planet', planet, 10], ['antiscia', antiscia, 530], ['contra-antiscia', contra, 710],
  ]) {
    near(circle.position.x, -2 * Math.sin(toRad(angle)), `${name} x`);
    near(circle.position.y, 2 * Math.cos(toRad(angle)), `${name} y`);
  }
  assert.strictEqual(triangle1.start, planet.position);
  assert.strictEqual(triangle1.end, antiscia.position);
  assert.strictEqual(triangle2.start, antiscia.position);
  assert.strictEqual(triangle3.end, planet.position);
  assert.strictEqual(contraLine.end, contra.position);
});

test('antiscia hover geometry is periodic under whole-turn longitude shifts', async () => {
  const options = {
    antisci: { Cardinale: true, Fissa: true, Mutevole: true },
    antisciTransitiHover: { nome: 'Sun' },
  };
  for (const longitude of [-45, 0, 10, 180, 359.999, 720]) {
    const normal = await render(options, longitude);
    const fullTurn = await render(options, longitude + 360);
    assert.equal(normal.objects.length, fullTurn.objects.length);
    const circles = normal.objects.filter(x => x.kind === 'circle');
    const shiftedCircles = fullTurn.objects.filter(x => x.kind === 'circle');
    assert.equal(circles.length, 9);
    for (let i = 0; i < circles.length; i++) {
      assert.ok(Math.abs(circles[i].position.x - shiftedCircles[i].position.x) < 1e-11,
        `x for circle ${i}, longitude ${longitude}`);
      assert.ok(Math.abs(circles[i].position.y - shiftedCircles[i].position.y) < 1e-11,
        `y for circle ${i}, longitude ${longitude}`);
    }
  }
});
