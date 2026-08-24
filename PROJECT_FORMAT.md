# Creative Whiteboard Project Format

Creative Whiteboard projects use the `.cwb` extension.

## Planned schema

The initial development format will be validated JSON with:

- A manifest using format identifier `creative-whiteboard-project`
- A numeric schema version
- Typed board objects and layers
- Camera, grid, snapping, canvas, and project settings
- Asset references

The serializer, validator, migrations, and atomic saving behavior are intentionally scheduled for Phase 7. Before public release, `.cwb` will become a compressed package containing manifest, board, settings, thumbnail, assets, and previews.

No stable file-format compatibility is claimed in Phase 1.
