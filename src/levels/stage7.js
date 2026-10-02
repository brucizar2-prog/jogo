// Fase medida a partir dos mapas do arcade original (edite à vontade).
// Unidades: pixels originais (1 tile = 16px), y cresce para baixo; x/y das entidades = centro/pés.
// Legenda dos tiles: "#" sólido, "=" plataforma (atravessável por baixo), "." vazio.
export default {
  id: 7,
  name: "Sala do Trono",
  theme: "throne",
  time: 180,
  start: {"x":40,"y":176},
  checkpoint: null,
  ladders: [],
  solids: [],
  oneways: [],
  hazards: [],
  platforms: [],
  spawners: [],
  entities: [
    {"t":"princess","x":242,"y":176}
  ],
  boss: {"t":"astaroth","x":160,"y":176,"trigger":0,"arena":[0,256]},
  door: null,
  w: 16,
  h: 14,
  rows: [
    "################",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "################",
    "################",
    "################"
  ]
};
