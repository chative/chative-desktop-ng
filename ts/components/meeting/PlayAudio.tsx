declare const Sound: any;

const callInitiativeAudio = new Sound({
  loop: true,
  src: '../audio/CallInitiative.mp3',
});
const callOffAudio = new Sound({
  loop: false,
  src: '../audio/CallOff.mp3',
});
const joinMeetingAudio = new Sound({
  loop: false,
  src: '../audio/JoinMeeting.ogg',
});
const joinMeetingAudioSmall = new Sound({
  loop: false,
  src: '../audio/JoinMeeting.ogg',
  volume: 0.02,
});

const playAudio = (type: any) => {
  callInitiativeAudio.stop();
  callOffAudio.stop();
  joinMeetingAudio.stop();

  switch (type) {
    case 'call-initiative':
      callInitiativeAudio.play();
      break;
    case 'call-off':
      callOffAudio.play();
      break;
    case 'call-joined-meeting':
      joinMeetingAudio.play();
      break;
    case 'call-joined-meeting-small':
      joinMeetingAudioSmall.play();
      break;
    default:
      break;
  }
};

export default playAudio;
