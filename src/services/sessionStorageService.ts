'use strict';

import { Memento } from "vscode";

/**
 * This class is to set object in context
 */
export class SessionStorageService {
    
   
    constructor(private storage: Memento) { }   
    
    public getValue<T>(key : string, t : T) : T{
        return this.storage.get<T>(key, t);
    }

    public setValue<T>(key : string, value : T){
        this.storage.update(key, value );
    }
}