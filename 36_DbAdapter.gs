class DBAdapter {
  table(name) { throw new Error('Not implemented'); }
  audit(action, resourceType, metadata) { throw new Error('Not implemented'); }
}

class SheetsDBAdapter extends DBAdapter {
  constructor(db) {
    super();
    this._db = db;
  }

  table(name) {
    return this._db.table(name);
  }

  audit(action, resourceType, metadata) {
    return this._db.audit(action, resourceType, metadata || {});
  }
}
