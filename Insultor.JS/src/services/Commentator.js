/**
 * Time from face detection until we stop waiting for face identification,
 * to deliver a generic comment on facial attributes instead of the persona.
 */
const IDENTIFY_PERSON_TIMEOUT_MS = 10000; // 10 s

class Commentator {

	constructor() {
	}

  onFacesDetected(faces) {
		if (!faces || faces.length == 0) {
			console.error('No faces received.');
			return;
		}
		console.info(`Commentator: Detected ${faces.length} faces.`, faces);

		// TODO Support multiple faces
		const face = faces[0];
		const handler = setTimeout(() => {

		}, IDENTIFY_PERSON_TIMEOUT_MS);
		this.
  }

  onPersonsIdentified(persons) {
    console.info(`Commentator: Identified ${persons.length} persons.`, persons);
    const person = persons[0];
    const firstName = person.name.split(' ')[0];
    const detectionState = `${STATE_PERSON_IDENTIFIED}: ${persons.map(person => person.name).join(', ')}`;
    this.setState({detectionState})

    const period = getTimePeriodOfDay();
    switch (firstName) {
      case 'Andreas': {
        switch (period) {
          case 'morning':
            this.speak(`God morgen sjef! På tide å ta over verden!`);
            break;
          case 'evening':
            this.speak(`Hei igjen sjef, jeg håper du har hatt en flott dag i dag!`);
            break;
          case 'late evening':
            this.speak(`Det begynner å bli seint sjef, på tide å legge seg!`);
            break;
          case 'night':
            this.speak(`Oi.. Hva gjør du oppe nå, sjef?`);
            break;
          default:
            console.error('Unknown time period', period);
        }
        break;
      }
      case 'Marthe':{
        switch (period) {
          case 'morning':
            this.speak(`God morgen kjære! Ha en fantastisk dag i dag!`);
            break;
          case 'evening':
            this.speak(`Hei pus, hvordan går det? Jeg håper du har hatt en flott dag i dag!`);
            break;
          case 'late evening':
            this.speak(`Nå er det på tide å bysse lalle, ta med deg sjefen og finn senga så du er klar for morgendagen!`);
            break;
          case 'night':
            this.speak(`Oi.. Hva gjør du oppe midt på natta? Du må se å komme deg i seng pus.`);
            break;
          default:
            console.error('Unknown time period', period);
        }
        break;
      }
      case 'Wenche':{
        this.speak(`Hei ${firstName}, du ser flott i dag mor!`);
        break;
      }
      case 'Maria':{
        this.speak(`Hei ${firstName}, så fint å ha deg på besøk!`);
        break;
      }
      case 'Svein':{
        this.speak(`Hei ${firstName}, høvdingen selv er på besøk!`);
        break;
      }
      default: {
        this.speak(`Hei ${firstName}!`);
      }

    }
    this.setState({ persons });

    // We got our person, now let's wait until he leaves before we start detecting again
    this.faceIdentityProvider.stop();
  }


}

export default Commentator;