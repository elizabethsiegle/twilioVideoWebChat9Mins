(() => {
  "use strict";
  const TWILIO_DOMAIN = location.host;
  const ROOM_NAME = "tf";
  const Video = Twilio.Video;
  let videoRoom, localStream;
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const minConfidence = 0.2;
  const VIDEO_WIDTH = document.getElementById("video").offsetWidth;
  const VIDEO_HEIGHT = document.getElementById("video").offsetHeight;
  const frameRate = 20;

  // preview screen
  navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then((vid) => {
      video.srcObject = vid;
      localStream = vid;
      const intervalID = setInterval(async () => {
        try {
          // ctx.scale(-1, 1);
          // ctx.translate(-VIDEO_WIDTH, 0);
          // Load the MediaPipe facemesh model.
          const model = await facemesh.load();

          // Pass in a video stream (or an image, canvas, or 3D tensor) to obtain an
          // array of detected faces from the MediaPipe graph.
          const predictions = await model.estimateFaces(video);
          console.log(`predictions ${predictions}`);
          if (predictions.length > 0) {
            for (let i = 0; i < predictions.length; i++) {
              const keypoints = predictions[i].scaledMesh;

              // Log facial keypoints.
              for (let i = 0; i < keypoints.length; i++) {
                const [x, y, z] = keypoints[i];

                console.log(`Keypoint ${i}: [${x}, ${y}, ${z}]`);
              }
            }
          }
          canvas.width = video.offsetWidth;
          canvas.height = video.offsetHeight;
          ctx.restore();
        } catch (err) {
          clearInterval(intervalID);
          console.log(err.message);
        }
      }, Math.round(1000 / frameRate));
      return () => clearInterval(intervalID);
    });

  // buttons
  const joinRoomButton = document.getElementById("button-join");
  const leaveRoomButton = document.getElementById("button-leave");
  var site = `https://${TWILIO_DOMAIN}/video-token`;
  console.log(`site ${site}`);
  joinRoomButton.onclick = () => {
    // get access token
    axios.get(`https://${TWILIO_DOMAIN}/video-token`).then(async (body) => {
      const token = body.data.token;
      console.log(token);

      Video.connect(token, { name: ROOM_NAME }).then((room) => {
        console.log(`Connected to Room ${room.name}`);
        videoRoom = room;

        room.participants.forEach(participantConnected);
        room.on("participantConnected", participantConnected);

        room.on("participantDisconnected", participantDisconnected);
        room.once("disconnected", (error) =>
          room.participants.forEach(participantDisconnected)
        );
        joinRoomButton.disabled = true;
        leaveRoomButton.disabled = false;
      });
    });
  };
  leaveRoomButton.onclick = () => {
    videoRoom.disconnect();
    console.log(`Disconnected from Room ${videoRoom.name}`);
    joinRoomButton.disabled = false;
    leaveRoomButton.disabled = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    //leave room, clear canvas
    document.removeChild(canvas);
  };
})();

const participantConnected = (participant) => {
  console.log(`Participant ${participant.identity} connected'`);

  const div = document.createElement("div");
  div.id = participant.sid;

  participant.on("trackSubscribed", (track) => trackSubscribed(div, track));
  participant.on("trackUnsubscribed", trackUnsubscribed);

  participant.tracks.forEach((publication) => {
    if (publication.isSubscribed) {
      trackSubscribed(div, publication.track);
    }
  });
  document.body.appendChild(div);
};

const participantDisconnected = (participant) => {
  console.log(`Participant ${participant.identity} disconnected.`);
  document.getElementById(participant.sid).remove();
};

const trackSubscribed = (div, track) => {
  div.appendChild(track.attach());
};

const trackUnsubscribed = (track) => {
  track.detach().forEach((element) => element.remove());
};
