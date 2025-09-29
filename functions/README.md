# Genkit-UI Firebase Functions

This directory contains the source code for deploying the Genkit agents and flows as Firebase Functions. This allows the multi-agent system to run in a serverless environment.

## Deployment

The functions are deployed using the Firebase CLI. The `firebase.json` file in the root of the project is configured to use this directory as the source for Firebase Functions.

To deploy the functions, run the following command from the project root:

```bash
firebase deploy --only functions
```

## App Hosting

This project also uses Firebase App Hosting to deploy the backend. The `apphosting.yaml` file configures the Cloud Run instance. The `firebase.json` file points to the root directory for App Hosting, and the `functions` directory is specified as the source for the backend.

To deploy the backend, run:

```bash
firebase deploy --only hosting:apphosting
```
