/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

export enum EntityType {
    UserId = "UserId",
    RoomAlias = "RoomAlias",
    RoomId = "RoomId",
}

export class MatrixURL {
    /**
     * The identifier of the top-level entity in the URL,
     * without the Matrix sigil. Check @{link kind} to determine
     * what kind of entity this URL represents.
     */
    id: string
    /**
     * The kind of entity represented by this link. @{link UserId}
     * corresponds to users or the "@" sigil, @{link RoomAlias} 
     * corresponds to room addresses and the "#" sigil, and @{link RoomId}
     * corresponds to room identifiers and the "!" sigil.
     */
    kind: EntityType
    /**
     * If this URL represents a link to an event in a room, the
     * identifier of that event, without the Matrix sigil.
     */
    eventId: string | null;

    /**
     * The fragment (presently unused) portion of the URL.
     */
    fragment: string | null;
    /**
     * The authority (presently unused) portion of the URL.
     */
    authority: string | null;

    /**
     * List of servers to route through, extracted from the URL's
     * query parameters.
     */
    via: string[];
    /**
     * The action specified by this URL, extracted from the query
     * parameters.
     */
    action: string | null;
    /**
     * Query parameters that are not reserved by the Matrix specification.
     * This field does not include the action and via fields. See
     * @{link via} and @{link action} fields.
     */
    unknownParams: {0: string, 1: string}[];

    /**
     * Parse a Matrix URL from a given string.
     * @throws {TypeError} if the link is not valid.
     */
    constructor(uri: string) {
        const url = new URL(uri);
        if (url.protocol !== "matrix:") {
            throw new TypeError("Not a matrix: scheme link");
        }
        this.fragment = url.hash.substring(1) || null;
        this.authority = null;
        let path = url.pathname;
        if (url.host) {
            // Node puts host into its own field.
            this.authority = url.host;
            path = path.substring(1);
        } else if (path.startsWith("//")) {
            // Browser seems to just give a pathname starting with //.
            this.authority = path.substring(2, path.indexOf("/", 2));
            path = path.substring(this.authority.length+4);
        }
        let queryParams: string[][];
        if (url.search) {
            queryParams = url.search.substring(1).split("&").map(s => s.split("="));
        } else {
            queryParams = [];
        }
        this._extractUrlData(path, queryParams);
    }

    _extractUrlData(path: string, queryParams: string[][]) {
        this.via = [];
        this.action = null;
        
        const paths = path.split("/");
        if (paths.length !== 2 && paths.length !== 4) {
            throw new TypeError("Invalid number of path segments");
        }
        switch (paths[0]) {
            case "u": this.kind = EntityType.UserId; break;
            case "r": this.kind = EntityType.RoomAlias; break;
            case "roomid": this.kind = EntityType.RoomId; break;
            default: throw new TypeError("Invalid entity descriptor");
        }
        this.id = paths[1];
        if (!this.id) {
            throw new TypeError("Empty mxid, not valid");
        }
        this.eventId = null;
        if (paths.length === 4) {
            if (paths[2] === "e" || paths[2] === "event") {
                if (this.kind !== EntityType.RoomId && this.kind !== EntityType.RoomAlias) {
                    throw new TypeError("Can only specify events on rooms or room aliases");
                } else if (!paths[3]) {
                    throw new TypeError("Invalid event URL");
                }
                this.eventId = paths[3];
            } else {
                throw new TypeError("Invalid entity descriptor");
            }
        }
        this.via = [];
        this.action = null;
        this.unknownParams = [];
        for (const [key,value] of queryParams) {
            if (key === "via") {
                this.via.push(value);
            } else if (key === "action") {
                this.action = value;
            } else {
                this.unknownParams.push([key, value]);
            }
        }
    }
}

export function tests() {
    const USER = "her:example.com";
    const EVENT = "lol823y4bcp3qo4";
    const RID = "rid:example.org";
    const ROOM = "us:example.org";
    const SERVER = "example.com";

    return {
        "Links with authority are correctly parsed": assert => {
            assert.equal(new MatrixURL(`matrix://${SERVER}/u/${USER}`).authority, SERVER);
            assert.equal(new MatrixURL(`matrix://${SERVER}/r/${ROOM}`).authority, SERVER);
            assert.equal(new MatrixURL(`matrix://${SERVER}/r/${ROOM}/e/${EVENT}`).authority, SERVER);
            assert.equal(new MatrixURL(`matrix://${SERVER}/roomid/${ROOM}/e/${EVENT}`).authority, SERVER);
        },
        "Links with fragments are correctly parsed": assert => {
            assert.equal(new MatrixURL(`matrix://${SERVER}/u/${USER}?action=chat&via=${SERVER}#some-fragment`).fragment, "some-fragment");
            assert.equal(new MatrixURL(`matrix://${SERVER}/r/${ROOM}#some-fragment`).fragment, "some-fragment");
            assert.equal(new MatrixURL(`matrix://${SERVER}/r/${ROOM}/e/${EVENT}#some-fragment`).fragment, "some-fragment");
            assert.equal(new MatrixURL(`matrix://${SERVER}/roomid/${ROOM}/e/${EVENT}#some-fragment`).fragment, "some-fragment");
        },
        "Links with actions are correctly parsed": assert => {
            const url1 = new MatrixURL(`matrix://${SERVER}/u/${USER}?action=chat&via=${SERVER}#some-fragment`);
            assert.equal(url1.action, "chat");
            assert.deepEqual(url1.via, [SERVER]);
            assert.deepEqual(url1.unknownParams, []);
        },
        "Last action is chosen if two actions are present": assert => {
            const url2 = new MatrixURL(`matrix://${SERVER}/r/${ROOM}?action=blah&action=chat`);
            assert.equal(url2.action, "chat");
            assert.deepEqual(url2.unknownParams, []);
        },
        "Only unknown query parameters are returned as unknownParams": assert => {
            const url3 = new MatrixURL(`matrix://${SERVER}/r/${ROOM}?action=blah&action=chat&client=element`);
            assert.equal(url3.action, "chat");
            assert.deepEqual(url3.unknownParams, [["client", "element"]]);
        },
        "User links are correctly extracted": assert => {
            const url = new MatrixURL(`matrix:u/${USER}`);
            assert.equal(url.id, USER);
            assert.equal(url.kind, EntityType.UserId);
        },
        "User links do not have event IDs": assert => {
            const url = new MatrixURL(`matrix:u/${USER}`);
            assert.equal(url.eventId, null);
        },
        "User links do not allow event IDs": assert => {
            assert.throws(() => {
                new MatrixURL(`matrix:u/${USER}/e/${EVENT}`);
            }, { name: 'TypeError' });
        },
        "Room aliases are correctly extracted": assert => {
            const url = new MatrixURL(`matrix:r/${ROOM}`);
            assert.equal(url.id, ROOM);
            assert.equal(url.kind, EntityType.RoomAlias);
        },
        "Room aliases do not have event IDs": assert => {
            const url = new MatrixURL(`matrix:r/${ROOM}`);
            assert.equal(url.eventId, null);
        },
        "Room aliases correctly parse event IDs": assert => {
            const url = new MatrixURL(`matrix:r/${ROOM}/e/${EVENT}`);
            assert.equal(url.eventId, EVENT);
        },
        "Room IDs are correctly extracted": assert => {
            const url = new MatrixURL(`matrix:roomid/${RID}`);
            assert.equal(url.id, RID);
            assert.equal(url.kind, EntityType.RoomId);
        },
        "Room IDs do not have event IDs": assert => {
            const url = new MatrixURL(`matrix:roomid/${RID}`);
            assert.equal(url.eventId, null);
        },
        "Room IDs correctly parse event IDs": assert => {
            const url = new MatrixURL(`matrix:roomid/${RID}/e/${EVENT}`);
            assert.equal(url.eventId, EVENT);
        },
    }
}
