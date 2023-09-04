/* global Whisper, Backbone, _, $ */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.ForwardedMessageListView = Backbone.View.extend({
    tagName: 'ul',
    className: 'forwarded-message-list',

    template: $('#forwarded-message-list').html(),
    itemView: Whisper.ForwardedMessageView,

    events: {
      scroll: 'onScroll',
    },

    timeoutMap: {},

    // Here we reimplement Whisper.ListView so we can override addAll
    render() {
      this.addAll();
      return this;
    },

    // The key is that we don't erase all inner HTML, we re-render our template.
    //   And then we keep a reference to .messages
    addAll() {
      Whisper.View.prototype.render.call(this);
      this.$messages = this.$('.messages');

      if (this.observer) {
        this.observer.disconnect();
      }

      if (this.timeoutMap) {
        for (const [_, timeoutId] of Object.entries(this.timeoutMap)) {
          // log.info(`clear timeout for ${targetId} ${timeoutId}`);
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      }

      this.collection.each(this.addOne, this);
    },

    initialize() {
      this.removeContextMenuListen = this.listenContextMenuShow(
        this.setReactContextMenu.bind(this)
      );

      this.render();

      this.triggerLazyScroll = _.debounce(() => {
        this.$el.trigger('lazyScroll');
      }, 500);

      const triggerShowMessage = target => {
        // log.info(`trigger show ${target.id}`);
        $(target).trigger('onShow');
      };

      this.observer = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach(entry => {
            // clear old timeout
            const targetId = entry.target.id;
            if (targetId) {
              const timeoutId = this.timeoutMap[targetId];
              if (timeoutId) {
                // log.info(`clear timeout for ${targetId} ${timeoutId}`);
                clearTimeout(timeoutId);
              }
            }

            if (entry.isIntersecting) {
              if (targetId) {
                const timeoutId = setTimeout(() => {
                  triggerShowMessage(entry.target);
                }, 500);
                this.timeoutMap[targetId] = timeoutId;
                // log.info(`set timeout for ${targetId} ${timeoutId}`);
              } else {
                triggerShowMessage(entry.target);
              }
            }
          });
        },
        {
          threshold: 0,
          root: this.el,
        }
      );
    },
    setReactContextMenu() {
      this.showReactContextMenu = true;
    },
    hideReactContextMenu() {
      // Magic, don't ask
      if (this.showReactContextMenu) {
        const tmpEvent = new window.CustomEvent('REACT_CONTEXTMENU_HIDE');
        window.dispatchEvent(tmpEvent);
        this.showReactContextMenu = false;
      }
    },
    onScroll() {
      this.hideReactContextMenu();
      this.measureScrollPosition();
    },
    atBottom() {
      return this.bottomOffset < 30;
    },
    atTop() {
      return this.$el.scrollTop() === 0;
    },
    measureScrollPosition() {
      if (this.el.scrollHeight === 0) {
        // hidden
        return;
      }

      // visible height
      this.outerHeight = this.$el.outerHeight();

      // up-invisible height + visible height
      this.scrollPosition = this.$el.scrollTop() + this.outerHeight;

      // total height includes all(visible+invisible)
      this.scrollHeight = this.el.scrollHeight;

      // down-invisible height
      this.bottomOffset = this.scrollHeight - this.scrollPosition;
    },
    resetScrollPosition() {
      // keep scroll position unchanged and
      // make sure last visible message is still visible
      this.$el.scrollTop(this.scrollPosition - this.$el.outerHeight());
    },
    restoreBottomOffset() {
      // keep bottomOffset unchanged
      if (_.isNumber(this.bottomOffset)) {
        // + 10 is necessary to account for padding
        const height = this.$el.height() + 10;

        const topOfBottomScreen = this.el.scrollHeight - height;
        this.$el.scrollTop(topOfBottomScreen - this.bottomOffset);
      }
    },
    scrollToBottomIfNeeded() {
      // This is counter-intuitive. Our current bottomOffset is reflective of what
      //   we last measured, not necessarily the current state. And this is called
      //   after we just made a change to the DOM: inserting a message, or an image
      //   finished loading. So if we were near the bottom before, we _need_ to be
      //   at the bottom again. So we scroll to the bottom.
      if (this.atBottom()) {
        this.scrollToBottom();
      }
    },
    scrollToBottom() {
      this.$el.scrollTop(this.el.scrollHeight);
      this.measureScrollPosition();
    },
    addOne(model) {
      // 校验 markdown 消息内容是否为空， 为空的话，直接不展示。
      const { card } = model.attributes || {};
      const { content } = card || {};
      if (card && !content) {
        window.log.error(
          'added empty card messages',
          model.idForLogging(),
          model.get('conversationId')
        );
        return;
      }

      // eslint-disable-next-line new-cap
      const view = new this.itemView({
        model,
        observer: this.observer,
      });
      view.render();

      this.listenTo(view, 'beforeChangeHeight', this.measureScrollPosition);
      this.listenTo(view, 'afterChangeHeight', this.scrollToBottomIfNeeded);

      const index = this.collection.indexOf(model);
      this.measureScrollPosition();

      if (index === this.collection.length - 1) {
        // add to the bottom.
        this.$messages.append(view.el);
      } else if (index === 0) {
        // add to top
        this.$messages.prepend(view.el);
      } else {
        const insertBeforeNext = next => {
          const element = this.$(`#${this.collection.at(next).id}`);
          if (element.length) {
            view.$el.insertBefore(element);
            return true;
          }

          return false;
        };

        const insertAfterPrev = prev => {
          const element = this.$(`#${this.collection.at(prev).id}`);
          if (element.length) {
            view.$el.insertAfter(element);
            return true;
          }

          return false;
        };

        const insertIntoView = () => {
          let next = index + 1;
          let prev = index - 1;

          do {
            if (next < this.collection.length) {
              if (insertBeforeNext(next)) {
                return true;
              }

              next++;
            }

            if (prev >= 0) {
              if (insertAfterPrev(prev)) {
                return true;
              }

              prev--;
            }
          } while (next < this.collection.length && prev >= 0);

          return false;
        };

        // insert
        if (!insertIntoView()) {
          this.$messages.append(view.el);
        }
      }
      this.scrollToBottomIfNeeded();
    },

    remove() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      // clear exists timers
      if (this.timeoutMap) {
        for (const [targetId, timeoutId] of Object.entries(this.timeoutMap)) {
          // log.info(`clear timeout for ${targetId} ${timeoutId}`);
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
        this.timeoutMap = null;
      }

      if (this.removeContextMenuListen) {
        this.removeContextMenuListen();
        this.removeContextMenuListen = null;
      }

      Backbone.View.prototype.remove.call(this);
    },

    listenContextMenuShow(callback) {
      const eventShow = 'REACT_CONTEXTMENU_SHOW';
      window.addEventListener(eventShow, callback);

      return () => window.removeEventListener(eventShow, callback);
    },
  });
})();
