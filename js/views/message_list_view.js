/* global Whisper, Backbone, _, $ */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.MessageListView = Backbone.View.extend({
    tagName: 'ul',
    className: 'message-list',

    template: $('#message-list').html(),
    itemView: Whisper.MessageView,
    events: {
      scroll: 'onScroll',
      // mousemove: 'onMouseMove',
    },

    timeoutMap: {},

    render() {
      Whisper.View.prototype.render.call(this);
      this.$messages = this.$('.messages');
      return this;
    },

    initialize(options = {}) {
      this.removeContextMenuListen = this.listenContextMenuShow(
        this.setReactContextMenu.bind(this)
      );

      this.listMode = options.listMode;

      this.itemRenderQueue = new window.PQueue({ concurrency: 1 });

      // this.listenTo(this.collection, 'add', this.addOne);
      this.listenTo(this.collection, 'reset', this.onCollectionReset);
      this.listenTo(this.collection, 'update', this.onCollectionUpdate);
      this.listenTo(this.collection, 'reload-message', this.reloadMessage);

      this.render();

      this.triggerLazyScroll = _.debounce(
        () => this.$el.trigger('lazyScroll'),
        500
      );

      this.triggerLoadMore = _lodash.throttle(
        upward => this.$el.trigger('loadMore', upward),
        1000
      );

      this.triggerAtBottom = _lodash.throttle(
        () => this.$el.trigger('atBottom'),
        1000
      );

      const triggerShowMessage = target => {
        // log.info(`trigger show ${target.id}`);
        $(target).trigger('onShow');
      };

      this.observer = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach(entry => {
            const { target, isIntersecting } = entry;

            // clear old timeout
            const targetId = target.id;
            if (targetId) {
              const timeoutId = this.timeoutMap[targetId];
              if (timeoutId) {
                // log.info(`clear timeout for ${targetId} ${timeoutId}`);
                clearTimeout(timeoutId);
              }
            }

            if (isIntersecting) {
              if (targetId) {
                const timeoutId = setTimeout(() => {
                  triggerShowMessage(target);
                }, 500);
                this.timeoutMap[targetId] = timeoutId;
                // log.info(`set timeout for ${targetId} ${timeoutId}`);
              } else {
                triggerShowMessage(target);
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

    // render all list items in collection
    renderList(options) {
      // reset all message
      // stop listen all previous message
      if (this.observer) {
        this.observer.disconnect();
      }

      // clear exists timers
      if (this.timeoutMap) {
        for (const [targetId, timeoutId] of Object.entries(this.timeoutMap)) {
          // log.info(`clear timeout for ${targetId} ${timeoutId}`);
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      }

      // clear exists rendering job
      this.stopAdd = true;

      if (this.itemRenderQueue) {
        this.itemRenderQueue.clear();
        return this.itemRenderQueue.onIdle().then(() => {
          this.stopAdd = false;
          return this.queueAddSome(this.collection.models, options);
        });
      } else {
        this.stopAdd = false;
        return Promise.resolve();
      }
    },

    onCollectionUpdate(_, options) {
      if (options.add) {
        const { added } = options.changes;
        const promise = this.queueAddSome(added, options);

        const { onCollectionChanged } = options;
        if (typeof onCollectionChanged === 'function') {
          onCollectionChanged(promise);
        }
      }
    },
    onCollectionReset(_, options) {
      this.render();

      // unload all previous messages
      const promise = Promise.all(
        (options.previousModels || []).map(
          model =>
            new Promise(resove => {
              setTimeout(() => {
                // unload message, should match listMode
                model.trigger('unload', { listMode: this.listMode });
                resove();
              }, 0);
            })
        )
      ).then(() => this.renderList(options));

      const { onCollectionChanged } = options || {};
      if (typeof onCollectionChanged === 'function') {
        onCollectionChanged(promise);
      }
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
    // onMouseMove(event) {
    //   this.moveX = event.pageX;
    //   this.moveY = event.pageY;
    // },

    listenToWheel(atTop) {
      this.$messages.off('wheel');
      this.$messages.on('wheel', event => {
        const { originalEvent } = event || {};
        const { deltaY } = originalEvent || {};

        if (
          (atTop && deltaY <= 0 && this.atTop()) ||
          (!atTop && deltaY >= 0 && this.bottomOffset < 1)
        ) {
          // already at top and continue trying to scroll up
          // or already at bottom and continue trying to scroll down
          this.triggerLoadMore(atTop);
        } else {
          // try to scroll to opposite, off the listen
          this.$messages.off('wheel');
        }
      });
    },
    onScroll() {
      // const offset = this.$el.offset();
      // const outerHeight = this.$el.outerHeight(true);
      // const outerWidth = this.$el.outerWidth(true);

      // if (
      //   offset.top < this.moveY &&
      //   offset.top + outerHeight > this.moveY &&
      //   offset.left < this.moveX &&
      //   offset.left + outerWidth > this.moveY
      // ) {
      //   if (this.scrollTimeout) {
      //     clearTimeout(this.scrollTimeout);
      //   }

      //   if (!this.isShowScrollBar) {
      //     this.$el.toggleClass('list-scrolling');
      //     this.isShowScrollBar = true;
      //   }

      //   this.scrollTimeout = setTimeout(() => {
      //     this.$el.toggleClass('list-scrolling', false);
      //     this.scrollTimeout = null;
      //     this.isShowScrollBar = false;
      //   }, 1000);
      // }

      this.hideReactContextMenu();
      this.measureScrollPosition();

      // there are scrollTop === 0 and bottomOffset === 0 when reset list
      // should not loadMore
      const scrollTop = this.$el.scrollTop();
      const upward = scrollTop === 0 && !this.atBottom();
      const downward = scrollTop !== 0 && this.atBottom();

      if (upward || downward) {
        this.triggerLoadMore(upward);
      }

      if (scrollTop < 1) {
        this.listenToWheel(true);
      } else if (this.atBottom()) {
        this.triggerAtBottom();

        if (this.bottomOffset < 1) {
          this.listenToWheel(false);
        }
      } else if (this.bottomOffset > 30) {
        this.$el.trigger('farFromBottom');
      }

      this.triggerLazyScroll();
    },
    atBottom() {
      return this.bottomOffset < 30;
    },
    atTop() {
      return this.$el.scrollTop() === 0;
    },
    hasNoScroll() {
      return Math.abs(this.outerHeight - this.scrollHeight) < 1;
    },
    measureScrollPosition() {
      if (this.el.scrollHeight === 0) {
        // hidden
        return;
      }

      // visible height
      // Get the current computed outer height
      // (including padding, border, and optionally margin)
      // is not always integer
      this.outerHeight = this.$el.outerHeight();

      // up-invisible height + visible height
      // scrollTop: If the scroll bar is at the very top,
      //            or if the element is not scrollable, this number will be 0.
      //  is not always integer
      this.scrollPosition = Math.round(this.$el.scrollTop() + this.outerHeight);

      // total height includes all(visible+invisible)
      // The height is measured in the same way as clientHeight:
      // it includes the element's padding, but not its border,
      // margin or horizontal scrollbar (if present).
      // It can also include the height of pseudo-elements such as ::before or ::after.
      // If the element's content can fit without a need for vertical scrollbar,
      // its scrollHeight is equal to clientHeight
      // This property will round the value to an integer.
      this.scrollHeight = this.el.scrollHeight;

      // down-invisible height
      this.bottomOffset = Math.round(this.scrollHeight - this.scrollPosition);
    },
    resetScrollPosition() {
      // keep scroll position unchanged and
      // make sure last visible message is still visible
      const position = Math.round(this.scrollPosition - this.$el.outerHeight());
      this.$el.scrollTop(position);
    },
    restoreBottomOffset() {
      // keep bottomOffset unchanged
      if (_.isNumber(this.bottomOffset)) {
        // + 10 is necessary to account for padding
        // height() : Get the current computed height for the first element
        // Note that .height() will always return the content height
        // Code should not assume it is an integer.
        const height = this.$el.height() + 10;

        const topOfBottomScreen = Math.round(this.el.scrollHeight - height);
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
    resetLastSeen(options) {
      this.$el.trigger('resetLastSeenIndicator', options);
    },
    queueAddOne(model, options) {
      return this.itemRenderQueue.add(
        async () => {
          if (this.stopAdd) {
            return;
          }

          await new Promise(r => setTimeout(r, 0));
          if (this.stopAdd) {
            return;
          }

          const view = this.renderItem(model);
          if (view) {
            await new Promise(r => setTimeout(r, 0));
            if (this.stopAdd) {
              return;
            }

            this.addOne(model, view, options);
          }
        },
        { priority: options?.newMessage ? 9 : 0 }
      );
    },
    queueAddSome(models, options) {
      if (!models?.length) {
        return Promise.resolve();
      }

      const { reverse, messageScrollTo, oldestUnread } = options || {};

      const mapAddModels = messages =>
        messages.map(message => this.queueAddOne(message, options));

      if (messageScrollTo) {
        const index = models.indexOf(messageScrollTo);
        if (index !== -1) {
          const modelsBefore = models.slice(0, index).reverse();
          const modelsAfter = models.slice(index);

          // include messageScrollTo
          const promisesAfter = mapAddModels(modelsAfter);
          const promisesBefore = mapAddModels(modelsBefore);

          Promise.any(promisesAfter).then(this.resetLastSeen.bind(this));

          return Promise.all(promisesAfter).then(() =>
            Promise.all(promisesBefore)
          );
        }
      }

      const added = models.slice(0);
      if (reverse) {
        added.reverse();
      }

      const promises = mapAddModels(added);

      if (oldestUnread) {
        const index = added.indexOf(oldestUnread);
        if (index !== -1) {
          promises[index] = promises[index].then(this.resetLastSeen.bind(this));
        }
      }

      return Promise.all(promises);
    },
    renderItem(model) {
      const card = model.get('card');
      if (card && !card.content) {
        window.log.error(
          'added empty card messages',
          model.idForLogging(),
          model.get('conversationId')
        );
        return;
      }

      if (model.isExpired()) {
        // expired message, just log it
        window.log.error(
          'added expired',
          model.idForLogging(),
          model.get('conversationId')
        );
      }

      // eslint-disable-next-line new-cap
      const view = new this.itemView({
        model,
        listMode: this.listMode,
        observer: this.observer,
      });
      view.render();

      return view;
    },
    addOne(model, view, options) {
      const exists = this.$(`#${model.id}`);
      if (exists.length) {
        log.info('view has been loaded', model.id, model.idForLogging());
        view.$el.trigger('destroy');
        return;
      }

      const index = this.collection.indexOf(model);
      this.measureScrollPosition();

      if (model.isIncoming() && !this.atBottom()) {
        setTimeout(async () => {
          if (model.isIncoming() && !(await model.isIncomingMessageRead())) {
            this.$el.trigger('newOffscreenMessage', model);
          }
        }, 0);
      }

      let foundViewTopPos;
      let foundViewHeight;
      let isInsertBeforeView;

      const recordFoundView = (view, isInsertBefore) => {
        if (view?.length) {
          isInsertBeforeView = isInsertBefore;
          foundViewTopPos = view.position().top;
          foundViewHeight = view.outerHeight(true);
        }
      };

      const { messageScrollTo, oldestUnread } = options || {};

      if (index === this.collection.length - 1) {
        // add to the bottom.
        recordFoundView(this.$('li').last(), false);

        this.$messages.append(view.el);
      } else if (index === 0) {
        recordFoundView(this.$('li').first(), true);

        // add to top
        if (this.archiveIndicator) {
          view.$el.insertAfter(this.archiveIndicator.$el);
        } else {
          this.$messages.prepend(view.el);
        }
      } else {
        const tryToInsert = (tryIndex, isBefore) => {
          const found = this.collection.at(tryIndex);
          if (!found) {
            return false;
          }

          if (found.propsForMessage?.status === 'sending') {
            return false;
          }

          const element = this.$(`#${found.id}`);
          if (!element.length) {
            return false;
          }

          recordFoundView(element, isBefore);

          if (isBefore) {
            // found message is the oldest unread message
            // which last seen indicator is before it
            // so we need insert before the last seen indicator
            if (found.id === oldestUnread?.id) {
              const lastSeenEl = this.$('.module-last-seen-indicator');
              if (lastSeenEl.length) {
                view.$el.insertBefore(lastSeenEl);
                return true;
              }
            }
            view.$el.insertBefore(element);
          } else {
            view.$el.insertAfter(element);
          }

          return true;
        };

        const insertIntoView = () => {
          let next = index + 1;
          let prev = index - 1;

          do {
            if (next < this.collection.length) {
              if (tryToInsert(next, true)) {
                return true;
              }

              next++;
            }

            if (prev >= 0) {
              if (tryToInsert(prev, false)) {
                return true;
              }

              prev--;
            }
          } while (next < this.collection.length && prev >= 0);

          return false;
        };

        // insert
        if (!insertIntoView()) {
          recordFoundView(this.$('li').last(), false);
          this.$messages.append(view.el);
        }
      }

      if (messageScrollTo) {
        const scrollIndex = this.collection.indexOf(messageScrollTo);
        if (index >= scrollIndex) {
          this.resetScrollPosition();
        } else {
          this.restoreBottomOffset();
        }
        // const lastSeenEl = this.$('.module-last-seen-indicator');
        // if (lastSeenEl.length) {
        //   lastSeenEl[0].scrollIntoView();
        // } else {
        //   this.resetScrollPosition();
        // }
      } else {
        if (
          typeof foundViewHeight === 'number' &&
          typeof foundViewTopPos === 'number'
        ) {
          const foundViewBtmPos = foundViewTopPos + foundViewHeight;

          if (foundViewBtmPos < this.outerHeight) {
            this.restoreBottomOffset();
          } else if (
            foundViewTopPos <= this.outerHeight &&
            foundViewBtmPos >= this.outerHeight
          ) {
            if (isInsertBeforeView) {
              this.restoreBottomOffset();
            } else {
              this.resetScrollPosition();
            }
          } else {
            this.resetScrollPosition();
          }
        }
      }

      if (options?.newMessage) {
        this.scrollToBottomIfNeeded();
      }
    },
    reloadMessage(model) {
      // this reload function should be synchronous
      if (!model) {
        return;
      }

      // unload message, should match listMode
      model.trigger('unload', { listMode: this.listMode });

      if (!this.collection.contains(model)) {
        return;
      }

      // no need to queue this for
      //  we want to add this model after exists removed without interruption.
      const view = this.renderItem(model);
      if (view) {
        this.addOne(model, view);
        this.scrollToBottomIfNeeded();
      } else {
        log.info('render message failed', model.id, model.idForLogging());
      }
    },

    updateArchiveIndicator(expire_timer) {
      if (this.archiveIndicator) {
        if (expire_timer > 0) {
          this.archiveIndicator.reset(expire_timer);
        } else {
          this.archiveIndicator.remove();
          this.archiveIndicator = null;
        }
      } else {
        this.prependArchiveIndicatorIfNeeded(null, expire_timer);
      }
    },

    prependArchiveIndicatorIfNeeded(count, expire_timer) {
      //  expire_timer should be positive value
      if (
        this.atTop() &&
        (count === 0 || (this.scrollHeight && this.hasNoScroll())) &&
        typeof expire_timer === 'number' &&
        expire_timer > 0
      ) {
        if (this.archiveIndicator) {
          this.archiveIndicator.reset(expire_timer);
        } else {
          this.archiveIndicator = new Whisper.ArchiveIndicatorView({
            expire_timer,
          });

          this.$messages.prepend(this.archiveIndicator.el);
        }
      } else {
        if (this.archiveIndicator) {
          this.archiveIndicator.remove();
          this.archiveIndicator = null;
        }
      }
    },

    remove() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      // make sure off wheel
      this.$messages.off('wheel');

      if (this.triggerAtBottom) {
        this.triggerAtBottom.cancel();
        this.triggerAtBottom = null;
      }

      if (this.triggerLazyScroll) {
        this.triggerLazyScroll.cancel();
        this.triggerLazyScroll = null;
      }

      if (this.triggerLoadMore) {
        this.triggerLoadMore.cancel();
        this.triggerLoadMore = null;
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

      if (this.itemRenderQueue) {
        this.stopAdd = true;

        // do not clear, for some renderPromises may nerver be resolved
        // this.itemRenderQueue.clear();
        this.itemRenderQueue = null;
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
