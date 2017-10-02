export const jokes = {

  moustache: moustache => [
    `Do you know the difference between a moustache and a gay moustache? The smell!`
  ],

  // beard: number
  beard: beard => [
    `Who shaves 10 times a day and still has a beard? The barber.`
  ],

  // hair: { bald: number, invisible: number, hairColor: [] }
  // hair: hair => TODO,

  // hairColor: { color: string, confidence: number }
  hairColor: hairColor => [
    `Am I seeing some grey spots inside that lush, ${hairColor[0].color} noggin?`
  ],


  // anger: number
  anger: anger => [`Whoa.. why so angry mister?`],
  // happiness: number
  happiness: happiness => [`Happy, so happy! I'm so happy today!`],
  // neutral: number
  neutral: neutral => [`Lookin'.. neutral bro!`],


  // glasses: string
  glasses: glasses => {
    switch (glasses) {
      case 'ReadingGlasses':
        return 'I was elected to LEAD, not to READ.';

      case 'Sunglasses':
        return 'Dude, drop the sunglasses. It\'s not SUNNY inside!';

      case 'SwimmingGoggles':
        return 'Swimming goggles... really? REALLY!?';

      default:
        return undefined;
    }
  }

};