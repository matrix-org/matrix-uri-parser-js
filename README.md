# `matrix-uri-parser-js`

**This is still work in progress.**

JavaScript / TypeScript parser for the URI scheme of the Matrix chat protocol.

## Usage
The package exposes a class, `MatrixURL`, whose constructor accepts s string (the URI to parse).

```TypeScript
import {MatrixURL, EntityType} from "matrix-uri-parser";
import assert from 'assert/strict';

const result = new MatrixURL("matrix:roomid/rid:example.org/event/lol823y4bcp3qo4?via=example2.org");
assert.equal(result.kind, EntityType.RoomId);
assert.equal(result.id, "rid:example.org");
assert.equal(result.eventId, "lol823y4bcp3qo4");
assert.deepEqual(result.via, ["example2.org"]);
```
