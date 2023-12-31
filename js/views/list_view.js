/* global Backbone, Whisper, _ */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  /*
   * Generic list view that watches a given collection, wraps its members in
   * a given child view and adds the child view elements to its own element.
   */
  Whisper.ListView = Backbone.View.extend({
    tagName: 'ul',
    itemView: Backbone.View,
    initialize(options) {
      this.options = options || {};
      this.viewArray = [];
      this.listenTo(this.collection, 'add', this.prependOne);
      this.listenTo(this.collection, 'reset', this.addAll);
    },

    addOne(model) {
      if (this.itemView) {
        const options = _.extend({}, this.options.toInclude, { model });
        // eslint-disable-next-line new-cap
        const view = new this.itemView(options);
        this.viewArray.push(view);
        this.$el.append(view.render().el);
        this.$el.trigger('add');
      }
    },

    prependOne(model) {
      if (this.itemView) {
        const options = _.extend({}, this.options.toInclude, { model });
        // eslint-disable-next-line new-cap
        const view = new this.itemView(options);
        this.viewArray.push(view);
        this.$el.prepend(view.render().el);
        this.$el.trigger('add');
      }
    },

    addAll() {
      this.$el.html('');
      this.collection.each(this.addOne, this);
    },

    render() {
      this.addAll();
      return this;
    },

    remove() {
      this.viewArray.forEach(view => {
        view.remove();
      });
      Backbone.View.prototype.remove.call(this);
    },
  });
})();
