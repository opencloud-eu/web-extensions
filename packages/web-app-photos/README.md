# web-app-photos

A photos dashboard for OpenCloud Web, built as a showcase for the Graph Search API and its
aggregation capabilities.

The start page greets the user with:

- **Memories**: "Do you remember?" strips with photos taken on this day in previous years
  (range queries on `photo.takenDateTime`)
- **Library stats**: photo count, total size, camera and place counts (metric aggregations)
- **Photos over time**: a monthly histogram of when photos were taken
- **Cameras**: most used camera models (`terms` aggregation on `photo.cameraModel`)
- **Places**: most photographed places (geohash aggregation on `location`)
- **Tags**: most used tags

Each card displays the underlying aggregation as a small chip, making the demo self-explaining.

Currently the app renders mock data shaped exactly like the Graph Search API responses
(`SearchAggregation`, `SearchBucket`, metric values), so wiring it to a real backend is a matter
of swapping the data source in `src/composables/usePhotoLibrary.ts`.
