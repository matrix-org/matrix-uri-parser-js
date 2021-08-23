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
    id: string
    kind: EntityType
    eventId: string | null;

    fragment: string | null;
    authority: string  | null;

    via: string[];
    action: string | null;
    unknownParams: {0: string, 1: string}[];

    constructor(uri: string) {
        const url = new URL(uri);
        if (url.protocol !== "matrix:") {
            throw new TypeError("Not a matrix: scheme link");
        }
        this.fragment = url.hash.substring(1) || null;
        this.authority = null;
        let path = url.pathname;
        if (path.startsWith("//")) {
            this.authority = path.substring(2, path.indexOf("/", 2));
            path = path.substring(this.authority.length+3);
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
        if (paths.length === 4 && (this.kind === EntityType.RoomId || this.kind === EntityType.RoomAlias)) {
            if ((paths[2] !== "e" && paths[2] !== "event") || !paths[3]) {
                throw new TypeError("Invalid event URL");
            }
            this.eventId = paths[3];
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
