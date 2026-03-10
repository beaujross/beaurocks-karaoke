const HOST_GAME_MATRIX = [
  {
    id: "flappy_bird",
    hostLabel: "Flappy Bird",
    expectedHostModes: ["flappy_bird"],
    audienceRegex: /flappy|tap screen to flap|crowd mic mode is running|score:/i,
    tvRegex: /flappy|score:|click or press space to flap|tap screen to flap/i,
  },
  {
    id: "vocal_challenge",
    hostLabel: "Vocal Challenge",
    expectedHostModes: ["vocal_challenge"],
    audienceRegex: /vocal challenge|score|round summary|loading vocal challenge/i,
    tvRegex: /vocal challenge|score|round summary|loading vocal challenge/i,
  },
  {
    id: "riding_scales",
    hostLabel: "Riding Scales",
    expectedHostModes: ["riding_scales"],
    audienceRegex: /riding scales|round|round summary|loading riding scales/i,
    tvRegex: /riding scales|round|round summary|loading riding scales/i,
  },
  {
    id: "team_pong",
    hostLabel: "Team Pong",
    expectedHostModes: ["team_pong"],
    audienceRegex: /team pong|tap to send \+1 hit|your team|rally/i,
    tvRegex: /team pong|tap phone = \+1 hit|rally|teamwork/i,
    interaction: {
      type: "click_text",
      textRegex: /tap to send \+1 hit/i,
      successRegex: /your team|rally|tap to send \+1 hit/i,
    },
  },
  {
    id: "trivia_pop",
    hostLabel: "Trivia",
    expectedHostModes: ["trivia_pop", "trivia_reveal"],
    audienceRegex: /trivia|pick the correct answer|answer locked|correct|not this time/i,
    audienceSelector: "[data-qa-player-view='trivia']",
    tvRegex: /trivia|responses locked|pick the correct answer/i,
    tvSelector: "[data-qa-tv-view='trivia']",
    interaction: {
      type: "click_selector",
      selector: "[data-qa-choice='0']",
      successRegex: /answer locked|correct|not this time|no answer submitted/i,
    },
  },
  {
    id: "wyr",
    hostLabel: "Would You Rather",
    expectedHostModes: ["wyr", "wyr_reveal"],
    audienceRegex: /would you rather|vote cast|pick a side|option a|option b/i,
    audienceSelector: "[data-qa-player-view='wyr']",
    tvRegex: /would you rather|crowd split|option a|option b/i,
    tvSelector: "[data-qa-tv-view='wyr']",
    interaction: {
      type: "click_selector",
      selector: "[data-wyr-choice='A']",
      successRegex: /vote cast|no vote submitted|watch tv for results/i,
    },
  },
  {
    id: "bingo",
    hostLabel: "Bingo",
    expectedHostModes: ["bingo"],
    audienceRegex: /bingo|karaoke bingo|mystery bingo|bingo live/i,
    tvRegex: /bingo|karaoke bingo|mystery bingo|bingo live/i,
    interaction: {
      type: "click_selector",
      selector: "button[aria-label^='Suggest tile']",
      successRegex: /send|cancel|bingo|mystery bingo/i,
    },
  },
  {
    id: "doodle_oke",
    hostLabel: "Doodle-oke",
    expectedHostModes: ["doodle_oke"],
    audienceRegex: /doodle-oke|lyric line showdown|draw the lyric line/i,
    tvRegex: /doodle-oke|sketch the lyric|waiting for sketches/i,
    fixture: {
      singers: [
        { name: "QA Sketch One" },
        { name: "QA Sketch Two" },
      ],
    },
  },
  {
    id: "selfie_challenge",
    hostLabel: "Selfie Challenge",
    expectedHostModes: ["selfie_challenge"],
    audienceRegex: /selfie challenge|waiting for selfies|tap to submit your selfie/i,
    tvRegex: /selfie challenge|waiting for selfies|strike a pose|vote/i,
    fixture: {
      singers: [
        { name: "QA Selfie One" },
        { name: "QA Selfie Two" },
      ],
    },
  },
  {
    id: "karaoke_bracket",
    hostLabel: "Sweet 16 Bracket",
    expectedHostModes: ["karaoke_bracket"],
    audienceRegex: /sweet 16 bracket|karaoke tournament|bracket not ready|audience vote/i,
    tvRegex: /sweet 16 bracket|karaoke tournament|bracket not ready|round complete/i,
    fixture: {
      singers: [
        {
          name: "Bracket One",
          tight15SearchTerms: ["Bohemian Rhapsody"],
        },
        {
          name: "Bracket Two",
          tight15SearchTerms: ["Don't Stop Believin"],
        },
      ],
    },
  },
];

const getHostGameMatrixEntry = (gameId = "") =>
  HOST_GAME_MATRIX.find((entry) => entry.id === String(gameId || "").trim().toLowerCase()) || null;

export { HOST_GAME_MATRIX, getHostGameMatrixEntry };
