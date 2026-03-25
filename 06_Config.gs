/**
 * Typed config access layer. Wraps ConfigBootstrap for domain-level consumers.
 * All config reads in domain services go through this object, not direct ConfigBootstrap calls.
 */
var AppConfig = {
  _cache: null,
  get: function() {
    if (!this._cache) {
      this._cache = ConfigBootstrap.load();
    }
    return this._cache;
  },
  reset: function() {
    this._cache = null;
  }
};
