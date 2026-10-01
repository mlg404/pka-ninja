import { fold } from "./pka";

/** Craft recipe for one elemental boost stone. The finished item is `${tier} ${english} Stone`. */

export type BoostTier = {
  id: string;
  name: string;
  from: number;
  to: number;
};

export type PoolDrop = {
  name: string;
  pokemon: string;
  /** Market `item_name` when it is not a case-insensitive match of `name`. */
  marketName?: string;
};

export type BoostElement = {
  id: string;
  label: string;
  english: string;
  fragment: string;
  stone: string;
  pool: PoolDrop[];
};

export const BOOST_TIERS: BoostTier[] = [
  { id: "novice", name: "Novice", from: 0, to: 5 },
  { id: "elemental", name: "Elemental", from: 5, to: 10 },
  { id: "common", name: "Common", from: 10, to: 15 },
  { id: "enhanced", name: "Enhanced", from: 15, to: 20 },
  { id: "potent", name: "Potent", from: 20, to: 25 },
  { id: "advanced", name: "Advanced", from: 25, to: 30 },
  { id: "fortified", name: "Fortified", from: 30, to: 35 },
  { id: "supreme", name: "Supreme", from: 35, to: 40 },
  { id: "celestial", name: "Celestial", from: 40, to: 45 },
  { id: "mystic", name: "Mystic", from: 45, to: 50 },
];

export const BOOST_ELEMENTS: BoostElement[] = [
  {
    id: "bug",
    label: "Inseto",
    english: "Bug",
    fragment: "Bug Fragment",
    stone: "Cocoon Stone",
    pool: [
      { name: "Scythe", pokemon: "Scyther" },
      { name: "Scizor Claw", pokemon: "Scizor" },
      { name: "Pinsir Horn", pokemon: "Pinsir" },
    ],
  },
  {
    id: "dark",
    label: "Sombrio",
    english: "Dark",
    fragment: "Dark Fragment",
    stone: "Darkness Stone",
    pool: [
      { name: "Tyranitar Tail", pokemon: "Tyranitar" },
      { name: "Dark Canine Horns", pokemon: "Houndoom" },
      { name: "Shadow Tail", pokemon: "Hydreigon" },
      { name: "Dark Ears", pokemon: "Umbreon" },
    ],
  },
  {
    id: "dragon",
    label: "Dragão",
    english: "Dragon",
    fragment: "Dragon Fragment",
    stone: "Crystal Stone",
    pool: [
      { name: "Dragonair Tail", pokemon: "Dragonair" },
      { name: "Shadow Tail", pokemon: "Hydreigon" },
      { name: "Sea Dragon Fin", pokemon: "Kingdra" },
      { name: "Dragonite Tail", pokemon: "Dragonite" },
    ],
  },
  {
    id: "electric",
    label: "Elétrico",
    english: "Electric",
    fragment: "Electric Fragment",
    stone: "Thunder Stone",
    pool: [
      { name: "Electric Collar", pokemon: "Jolteon" },
      { name: "Electric Ear", pokemon: "Raichu" },
      { name: "Electric Tail", pokemon: "Electabuzz" },
      { name: "Electric Sheep Tail", pokemon: "Ampharos" },
      { name: "Luxray Ear", pokemon: "Luxray" },
    ],
  },
  {
    id: "fairy",
    label: "Fada",
    english: "Fairy",
    fragment: "Fairy Fragment",
    stone: "Heart Stone",
    pool: [
      { name: "Mimic Clothes", pokemon: "Mr. Mime" },
      { name: "Pink Fairy Bow", pokemon: "Sylveon" },
      { name: "Mystic Petal", pokemon: "Florges" },
      { name: "Yellow Mimikyu Head", pokemon: "Mimikyu" },
    ],
  },
  {
    id: "fighting",
    label: "Lutador",
    english: "Fighting",
    fragment: "Fighting Fragment",
    stone: "Punch Stone",
    pool: [
      { name: "Belt Of Champions", pokemon: "Machamp", marketName: "Belt of Champion" },
      { name: "Big Fist Gloves", pokemon: "Poliwrath" },
      { name: "Martial Arts Tail", pokemon: "Hitmontop" },
      { name: "Kick Machine", pokemon: "Hitmonlee" },
      { name: "Punching Machine", pokemon: "Hitmonchan" },
      { name: "Poison Bladder", pokemon: "Toxicroak" },
    ],
  },
  {
    id: "fire",
    label: "Fogo",
    english: "Fire",
    fragment: "Fire Fragment",
    stone: "Fire Stone",
    pool: [
      { name: "Fire Roof", pokemon: "Rapidash" },
      { name: "Magma Shell", pokemon: "Magcargo" },
      { name: "Fox Tail", pokemon: "Ninetales" },
      { name: "Dark Canine Horns", pokemon: "Houndoom" },
      { name: "Blaze Tail", pokemon: "Flareon" },
      { name: "Giant Piece Of Fur", pokemon: "Arcanine" },
      { name: "Magma Foot", pokemon: "Magmar" },
      { name: "Fire Wings", pokemon: "Charizard", marketName: "Fire Wing" },
    ],
  },
  {
    id: "flying",
    label: "Voador",
    english: "Flying",
    fragment: "Flying Fragment",
    stone: "Feather Stone",
    pool: [
      { name: "Farfetch'd Wing", pokemon: "Farfetch'd" },
      { name: "Fire Wing", pokemon: "Charizard" },
      { name: "Steel Wing", pokemon: "Skarmory" },
      { name: "Dodrio Feather", pokemon: "Dodrio" },
      { name: "Dragonite Tail", pokemon: "Dragonite" },
      { name: "Gyarados Tail", pokemon: "Gyarados" },
      { name: "Scythe", pokemon: "Scyther" },
      { name: "Blue Ray Tail", pokemon: "Mantine" },
    ],
  },
  {
    id: "ghost",
    label: "Fantasma",
    english: "Ghost",
    fragment: "Ghost Fragment",
    stone: "Ghost Stone",
    pool: [
      { name: "Ectoplasm", pokemon: "Gengar" },
      { name: "Miss Traces", pokemon: "Misdreavus" },
      { name: "Yellow Mimikyu Head", pokemon: "Mimikyu" },
    ],
  },
  {
    id: "grass",
    label: "Planta",
    english: "Grass",
    fragment: "Grass Fragment",
    stone: "Leaf Stone",
    pool: [
      { name: "Red Petal", pokemon: "Venusaur" },
      { name: "Big Petal", pokemon: "Meganium" },
      { name: "Gaia Hands", pokemon: "Tangrowth" },
      { name: "Piece Of Rock", pokemon: "Torterra" },
    ],
  },
  {
    id: "ground",
    label: "Terra",
    english: "Ground",
    fragment: "Ground Fragment",
    stone: "Earth Stone",
    pool: [
      { name: "King Ear", pokemon: "Nidoking" },
      { name: "Queen Ear", pokemon: "Nidoqueen" },
      { name: "Stone Rocks", pokemon: "Golem" },
      { name: "Rock Plate", pokemon: "Pupitar" },
      { name: "Steelix Tail", pokemon: "Steelix" },
      { name: "Bone", pokemon: "Marowak" },
      { name: "Piece Of Rock", pokemon: "Torterra" },
    ],
  },
  {
    id: "ice",
    label: "Gelo",
    english: "Ice",
    fragment: "Ice Fragment",
    stone: "Ice Stone",
    pool: [
      { name: "Lapras Fin", pokemon: "Lapras" },
      { name: "Psychic Wig", pokemon: "Jynx" },
    ],
  },
  {
    id: "normal",
    label: "Normal",
    english: "Normal",
    fragment: "Normal Fragment",
    stone: "Heart Stone",
    pool: [
      { name: "Cow Tail", pokemon: "Miltank" },
      { name: "Bull Tail", pokemon: "Tauros" },
      { name: "Kangaskhan Ear", pokemon: "Kangaskhan" },
      { name: "Farfetch'd Wing", pokemon: "Farfetch'd" },
      { name: "Big Crest", pokemon: "Pidgeot" },
      { name: "Snorlax Paw", pokemon: "Snorlax" },
      { name: "Bear Claw", pokemon: "Ursaring" },
    ],
  },
  {
    id: "poison",
    label: "Veneno",
    english: "Poison",
    fragment: "Poison Fragment",
    stone: "Venom Stone",
    pool: [
      { name: "Red Petal", pokemon: "Venusaur" },
      { name: "Ectoplasm", pokemon: "Gengar" },
      { name: "Stinky Hand", pokemon: "Muk" },
      { name: "Giant Ruby", pokemon: "Tentacruel" },
      { name: "King Ear", pokemon: "Nidoking" },
    ],
  },
  {
    id: "psychic",
    label: "Psíquico",
    english: "Psychic",
    fragment: "Psychic Fragment",
    stone: "Enigma Stone",
    pool: [
      { name: "Psychic Wig", pokemon: "Jynx" },
      { name: "Mimic Clothes", pokemon: "Mr. Mime" },
      { name: "Two-eyed Black Tail", pokemon: "Wobbuffet" },
      { name: "Psychic Moustache", pokemon: "Alakazam" },
      { name: "Psychic Ears", pokemon: "Espeon" },
      { name: "Slowking Necklace", pokemon: "Slowking" },
    ],
  },
  {
    id: "rock",
    label: "Pedra",
    english: "Rock",
    fragment: "Rock Fragment",
    stone: "Rock Stone",
    pool: [
      { name: "Tyranitar Tail", pokemon: "Tyranitar" },
      { name: "Magma Shell", pokemon: "Magcargo" },
      { name: "Rock Plate", pokemon: "Pupitar" },
      { name: "Stone Rocks", pokemon: "Golem" },
    ],
  },
  {
    id: "steel",
    label: "Aço",
    english: "Steel",
    fragment: "Steel Fragment",
    stone: "Metal Stone",
    pool: [
      { name: "Steel Wing", pokemon: "Skarmory" },
      { name: "Steelix Tail", pokemon: "Steelix" },
      { name: "Scizor Claw", pokemon: "Scizor" },
    ],
  },
  {
    id: "water",
    label: "Água",
    english: "Water",
    fragment: "Water Fragment",
    stone: "Water Stone",
    pool: [
      { name: "Blue Ray Tail", pokemon: "Mantine" },
      { name: "Frog Topknot", pokemon: "Politoed" },
      { name: "Big Fist Gloves", pokemon: "Poliwrath" },
      { name: "Red Hair", pokemon: "Feraligatr" },
      { name: "Giant Ruby", pokemon: "Tentacruel" },
      { name: "Lapras Fin", pokemon: "Lapras" },
      { name: "Sea Dragon Fin", pokemon: "Kingdra" },
      { name: "Aquatic Tail", pokemon: "Vaporeon" },
      { name: "Gyarados Tail", pokemon: "Gyarados" },
    ],
  },
];

export function finishedStoneName(element: BoostElement, tier: BoostTier): string {
  return `${tier.name} ${element.english} Stone`;
}

export function defaultPicks(poolSize: number): [number, number, number] {
  if (poolSize <= 0) return [0, 0, 0];
  return [0, Math.min(1, poolSize - 1), Math.min(2, poolSize - 1)];
}

export function dropMarketName(drop: PoolDrop): string {
  return drop.marketName ?? drop.name;
}

export type DayIngredient = {
  name: string;
  count: number;
};

export type DayRecipe = {
  name: string;
  category: string;
  ingredients: DayIngredient[];
};

export type DayCatalog = {
  capturedAt: string;
  recipes: DayRecipe[];
};

export function parseDayCatalog(data: unknown): DayCatalog | null {
  if (!data || typeof data !== "object") return null;
  const row = data as { capturedAt?: unknown; workshops?: unknown };
  if (!Array.isArray(row.workshops)) return null;
  const recipes: DayRecipe[] = [];
  for (const workshop of row.workshops) {
    if (!workshop || typeof workshop !== "object") continue;
    const list = (workshop as { recipes?: unknown }).recipes;
    if (!Array.isArray(list)) continue;
    for (const recipe of list) {
      if (!recipe || typeof recipe !== "object") continue;
      const rec = recipe as { name?: unknown; category?: unknown; ingredients?: unknown };
      if (typeof rec.name !== "string" || typeof rec.category !== "string" || !Array.isArray(rec.ingredients)) continue;
      const ingredients: DayIngredient[] = [];
      for (const ing of rec.ingredients) {
        if (!ing || typeof ing !== "object") continue;
        const item = ing as { name?: unknown; count?: unknown };
        if (typeof item.name !== "string" || typeof item.count !== "number") continue;
        ingredients.push({ name: item.name, count: item.count });
      }
      if (ingredients.length === 5) recipes.push({ name: rec.name, category: rec.category, ingredients });
    }
  }
  if (!recipes.length) return null;
  return { capturedAt: typeof row.capturedAt === "string" ? row.capturedAt : "", recipes };
}

export function findDayRecipe(catalog: DayCatalog, element: BoostElement, tier: BoostTier): DayRecipe | undefined {
  const wanted = fold(finishedStoneName(element, tier));
  return (
    catalog.recipes.find((recipe) => fold(recipe.category) === element.id && fold(recipe.name) === wanted) ??
    catalog.recipes.find((recipe) => fold(recipe.name) === wanted)
  );
}

export function findPoolDrop(element: BoostElement, name: string): PoolDrop | undefined {
  const key = fold(name);
  return element.pool.find((drop) => fold(drop.name) === key || fold(dropMarketName(drop)) === key);
}
