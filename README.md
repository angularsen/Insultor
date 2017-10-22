# INSULTOR

Delivers insults to your face, based on your face.

Potential domain names: insultmyface.com

### What is this repository for? ###

Proof of concept using Microsoft Cognitive Services' Face API to recognize face traits as well and optionally WHO it is to deliver suitable insults when they enter the camera zone.

### Discussion points

There are some things I'd like to discuss best-practices around in this project:

* How to deal with asynchronous worker-processes in state machines?
	- Keep periodically detecting faces in the background while waiting for identify faces and deliver comments states to complete and return back to `detectFaces` state and if any faces were detected in the meantime then immediately transition to `identifyFaces` again. I don't see how to draw/model this worker process in the state machine although the implementation is straight forward enough I want the code to match the model.

### How do I get set up? ###

* Summary of set up
* Configuration
* Dependencies
* Database configuration
* How to run tests
* Deployment instructions