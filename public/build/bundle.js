
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35731/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function generateBoard(board , [m, n] , b) {
        for (let i = 0 ; i < n ; ++i) {
            board[i] = [];
            for (let j = 0 ; j < m ; ++j) {
                board[i][j] = [0, false];
            }
        }
        let bCount = 0;
        while (bCount < b) {
            let x =Math.floor(Math.random() * (board.length));
            let y = Math.floor(Math.random() * (board[0].length));
            if(board[x][y][0] === 0){
                board[x][y][0] = -1;
                bCount++;
            }
        }
        return board;
    }

    function countNeighbours(board) {
        const dx = [1, 1, 1, 0, 0, -1, -1, -1];
        const dy = [1, 0, -1, 1, -1, 1, 0, -1];
        for (let row = 0; row < board.length; row++) {
            for (let col = 0; col < board[row].length; col++) {
                if (board[row][col][0] === -1) {
                    for (let i = 0 ; i < 8 ; i++) {
                        let nr = row + dy[i], nc = col + dx[i];
                        if (nr >= 0 && nr < board.length && nc >= 0 && nc < board[row].length ) {
                            if (board[nr][nc][0] !== -1) {
                                board[nr][nc][0] += 1;
                            }
                        }
                    }
                }
            }
        }
        return board
    }

    function randomBegin(board) {
        let nextMove = [7,15];
        if (board[nextMove[0]][nextMove[1]][0] === 1) {
            if (15 - nextMove[0] > 7 - nextMove[1]) {
                nextMove[0] += 1;
            }
            else {
                nextMove[1] += 1;
            }
        }
        return nextMove;
    }

    function countUnmarkedNeighbours(i,j , board) {
        let unmarked = [];
        let unflagged = [];
        const dx = [1, 1, 1, 0, 0, -1, -1, -1];
        const dy = [1, 0, -1, 1, -1, 1, 0, -1];
        for (let x = 0 ; x < 8 ; x++) {
            let nr = i + dy[x], nc = j + dx[x];
            if (nr >= 0 && nr < board.length && nc >= 0 && nc < board[i].length ) {
                if (board[nr][nc][1] === false || board[nr][nc][1] === "F" ) {
                    unmarked.push([nr,nc]);
                }
                if (board[nr][nc][1] === false) {
                    unflagged.push([nr,nc]);
                }
            }
        }
        return [unmarked, unflagged];
    }
    function countFlags(i,j , board) {
        let flags = 0;
        const dx = [1, 1, 1, 0, 0, -1, -1, -1];
        const dy = [1, 0, -1, 1, -1, 1, 0, -1];
        for (let x = 0 ; x < 8 ; x++) {
            let nr = i + dy[x], nc = j + dx[x];
            if (nr >= 0 && nr < board.length && nc >= 0 && nc < board[i].length ) {
                if (board[nr][nc][1] === "F" ) {
                    flags++;
                }
            }
        }
        return flags;
    }

    function getOpenCells(board) {
        let possCells = [];
        for (let i = 0; i < board.length; i++) {
            for (let j = 0; j < board[i].length; j++) {
                let [unmarked, unflagged] =  countUnmarkedNeighbours(i , j , board);
                if (board[i][j][1] === false || (board[i][j][0] === 0 && board[i][j][1] === true) || unflagged.length === 0) {
                    continue
                }
                possCells.push([i,j]);
            }
        }
        return possCells;
    }

    function bombEqualNum(possCells, board) {
        let markedCells = [];
        for (let i = 0; i < possCells.length; i++) {
            let [unmarked, flagged] = countUnmarkedNeighbours(possCells[i][0],possCells[i][1], board);
            if (unmarked.length === board[possCells[i][0]][possCells[i][1]][0] ) {
                markedCells.push(unmarked);
            }

        }
        return markedCells;
    }

    function randomGuess(possCells,board) {
        possCells.sort((a,b) => (board[a[0]][a[1]][0] - countUnmarkedNeighbours(a[0],a[1],board)[0].length) - (board[b[0]][b[1]][0]-countUnmarkedNeighbours(b[0],b[1], board)[0].length));
        const cell = possCells[0];
        let [neighbours, _] = countUnmarkedNeighbours(cell[0],cell[1], board );
        let guess = neighbours[Math.floor(Math.random() * neighbours.length)];
        return guess;
    }


    function oneDoubleTwoOne(possCells, board) {
        let toFlag = [];
        let toOpen = [];
        for (let i = 0; i < possCells.length; i++) {
            let [x,y] = possCells[i];
            if (board[x][y][0] - countFlags(x,y,board) === 1 && board[x][y+1][0] - countFlags(x,y,board) === 2 && board[x][y+2][0] - countFlags(x,y,board) === 2  && board[x][y+3][0] - countFlags(x,y,board) === 1 ) {
                if (x === 0 || (x > 0 && board[x - 1][y][1] !== false && board[x - 1][y + 1][1] !== false && board[x - 1][y + 2][1] !== false && board[x-1][y+3][1] !== false)) {
                    toOpen.push([x+1, y]);
                    toOpen.push([x+1, y+3]);
                    toFlag.push([x+1, y+1]);
                    toFlag.push([x+1, y+2]);
                }
                if (x === board.length-1 || (x < board.length - 1 && board[x + 1][y][1] !== false && board[x + 1][y + 1][1] !== false && board[x + 1][y + 2][1] !== false && board[x+1][y+3][1] !== false)) {
                    toOpen.push([x-1, y]);
                    toOpen.push([x-1, y+3]);
                    toFlag.push([x-1, y+1]);
                    toFlag.push([x-1, y+2]);
                }

            }
            if (board[x][y][0] - countFlags(x,y,board) === 1 && board[x+1][y][0] - countFlags(x,y,board) === 2 && board[x+2][y][0] - countFlags(x,y,board) === 2  && board[x+3][y][0] - countFlags(x,y,board) === 1 ) {
                if (y === 0 || (y > 0 && board[x][y - 1][1] !== false && board[x + 1][y - 1][1] !== false && board[x + 2][y - 1][1] !== false && board[x+3][y-1][1] !== false)) {
                    toOpen.push([x, y+1]);
                    toOpen.push([x+3, y+1]);
                    toFlag.push([x+1, y+1]);
                    toFlag.push([x+2, y+1]);
                }
                if (y === board.length-1 ||  (y < board.length - 1 && board[x][y + 1][1] !== false && board[x + 1][y + 1][1] !== false && board[x + 2][y + 1][1] !== false && board[x+3][y+1][1] !== false)) {
                    toOpen.push([x, y-1]);
                    toOpen.push([x+3, y-1]);
                    toFlag.push([x+1, y-1]);
                    toFlag.push([x+2, y-1]);
                }

            }

        }

        return [toFlag, toOpen]
    }

    function oneTwoOne(possCells, board) {
        let toFlag = [];
        let toOpen = [];
        for (let i = 0; i < possCells.length; i++) {
            let [x,y] = possCells[i];
            if (y+2 < board[0].length ) {
                if (board[x][y][0] - countFlags(x,y,board) === 1 && board[x][y + 1][0]  - countFlags(x,y+1,board) === 2 && board[x][y + 2][0]  - countFlags(x,y+2,board) === 1) {
                    if (x === 0 || (x > 0 && board[x - 1][y][1] !== false && board[x - 1][y + 1][1] !== false && board[x - 1][y + 2][1] !== false)) {
                        toOpen.push([x + 1, y + 1]);
                        toFlag.push([x + 1, y]);
                        toFlag.push([x + 1, y + 2]);
                    }
                    if (x === board.length - 1 || (x < board.length - 1 && board[x + 1][y][1] !== false && board[x + 1][y + 1][1] !== false && board[x + 1][y + 2][1] !== false)) {
                        toOpen.push([x - 1, y + 1]);
                        toFlag.push([x - 1, y]);
                        toFlag.push([x - 1, y + 2]);
                    }

                }
            }
            if (x+2 < board.length) {
                if (board[x][y][0]  - countFlags(x,y,board) === 1 && board[x + 1][y][0]  - countFlags(x+1,y,board) === 2 && board[x+2][y][0]  - countFlags(x+2,y,board) === 1) {
                    if (y === 0 || (y > 0 && board[x][y - 1][1] !== false && board[x + 1][y - 1][1] !== false && board[x + 2][y - 1][1] !== false)) {
                        toOpen.push([x + 1, y + 1]);
                        toFlag.push([x, y + 1]);
                        toFlag.push([x + 2, y + 1]);
                    }
                    if (y === board.length - 1 || (y < board.length - 1 && board[x][y + 1][1] !== false && board[x + 1][y + 1][1] !== false && board[x + 2][y + 1][1] !== false)) {
                        toOpen.push([x + 1, y - 1]);
                        toFlag.push([x, y - 1]);
                        toFlag.push([x + 2, y - 1]);
                    }

                }
            }

        }

        return [toFlag, toOpen]
    }

    /* src\App.svelte generated by Svelte v3.59.2 */

    const { console: console_1 } = globals;

    const file = "src\\App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[27] = list[i];
    	child_ctx[29] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[30] = list[i];
    	child_ctx[32] = i;
    	return child_ctx;
    }

    // (214:39) 
    function create_if_block_8(ctx) {
    	let h1;
    	let t1;
    	let h3;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "You Win!";
    			t1 = space();
    			h3 = element("h3");
    			h3.textContent = "Press Enter to play again";
    			attr_dev(h1, "class", "end svelte-1q7erz3");
    			add_location(h1, file, 214, 3, 5015);
    			attr_dev(h3, "class", "end svelte-1q7erz3");
    			add_location(h3, file, 215, 3, 5048);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, h3, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_8.name,
    		type: "if",
    		source: "(214:39) ",
    		ctx
    	});

    	return block;
    }

    // (211:2) {#if state === true}
    function create_if_block_7(ctx) {
    	let h1;
    	let t1;
    	let h3;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "You Lost";
    			t1 = space();
    			h3 = element("h3");
    			h3.textContent = "Press Enter to try again";
    			attr_dev(h1, "class", "end svelte-1q7erz3");
    			add_location(h1, file, 211, 3, 4893);
    			attr_dev(h3, "class", "end svelte-1q7erz3");
    			add_location(h3, file, 212, 3, 4926);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, h3, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(211:2) {#if state === true}",
    		ctx
    	});

    	return block;
    }

    // (238:6) {:else}
    function create_else_block_2(ctx) {
    	let div;

    	function select_block_type_4(ctx, dirty) {
    		if (/*board*/ ctx[1][/*i*/ ctx[29]][/*j*/ ctx[32]][0] === 0) return create_if_block_5;
    		if (/*board*/ ctx[1][/*i*/ ctx[29]][/*j*/ ctx[32]][0] > 0) return create_if_block_6;
    		return create_else_block_3;
    	}

    	let current_block_type = select_block_type_4(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			attr_dev(div, "class", "lost svelte-1q7erz3");
    			add_location(div, file, 238, 7, 5952);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_block.m(div, null);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_4(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2.name,
    		type: "else",
    		source: "(238:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (222:6) {#if state === false}
    function create_if_block(ctx) {
    	let if_block_anchor;

    	function select_block_type_2(ctx, dirty) {
    		if (/*board*/ ctx[1][/*i*/ ctx[29]][/*j*/ ctx[32]][1] === true) return create_if_block_1;
    		if (/*board*/ ctx[1][/*i*/ ctx[29]][/*j*/ ctx[32]][1] === 'F') return create_if_block_4;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type_2(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_2(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(222:6) {#if state === false}",
    		ctx
    	});

    	return block;
    }

    // (244:7) {:else}
    function create_else_block_3(ctx) {
    	let div;
    	let mounted;
    	let dispose;

    	function contextmenu_handler_7() {
    		return /*contextmenu_handler_7*/ ctx[21](/*i*/ ctx[29], /*j*/ ctx[32]);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "cell bomb svelte-1q7erz3");
    			add_location(div, file, 244, 8, 6220);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (!mounted) {
    				dispose = listen_dev(div, "contextmenu", prevent_default(contextmenu_handler_7), false, true, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_3.name,
    		type: "else",
    		source: "(244:7) {:else}",
    		ctx
    	});

    	return block;
    }

    // (242:36) 
    function create_if_block_6(ctx) {
    	let div;
    	let t_value = /*board*/ ctx[1][/*i*/ ctx[29]][/*j*/ ctx[32]][0] + "";
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "class", "cell num svelte-1q7erz3");
    			add_location(div, file, 242, 8, 6122);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);

    			if (!mounted) {
    				dispose = listen_dev(div, "contextmenu", prevent_default(/*contextmenu_handler_3*/ ctx[14]), false, true, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*board*/ 2 && t_value !== (t_value = /*board*/ ctx[1][/*i*/ ctx[29]][/*j*/ ctx[32]][0] + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(242:36) ",
    		ctx
    	});

    	return block;
    }

    // (240:7) {#if board[i][j][0] === 0}
    function create_if_block_5(ctx) {
    	let div;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "cell empty  svelte-1q7erz3");
    			add_location(div, file, 240, 8, 6015);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (!mounted) {
    				dispose = listen_dev(div, "contextmenu", prevent_default(/*contextmenu_handler_2*/ ctx[13]), false, true, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(240:7) {#if board[i][j][0] === 0}",
    		ctx
    	});

    	return block;
    }

    // (233:7) {:else}
    function create_else_block_1(ctx) {
    	let div;
    	let mounted;
    	let dispose;

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[19](/*i*/ ctx[29], /*j*/ ctx[32]);
    	}

    	function contextmenu_handler_6() {
    		return /*contextmenu_handler_6*/ ctx[20](/*i*/ ctx[29], /*j*/ ctx[32]);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "cell hidden  svelte-1q7erz3");
    			add_location(div, file, 233, 8, 5795);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(div, "click", click_handler_1, false, false, false, false),
    					listen_dev(div, "contextmenu", prevent_default(contextmenu_handler_6), false, true, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(233:7) {:else}",
    		ctx
    	});

    	return block;
    }

    // (231:40) 
    function create_if_block_4(ctx) {
    	let div;
    	let mounted;
    	let dispose;

    	function contextmenu_handler_5() {
    		return /*contextmenu_handler_5*/ ctx[18](/*i*/ ctx[29], /*j*/ ctx[32]);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "cell flag svelte-1q7erz3");
    			add_location(div, file, 231, 8, 5686);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (!mounted) {
    				dispose = listen_dev(div, "contextmenu", prevent_default(contextmenu_handler_5), false, true, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(231:40) ",
    		ctx
    	});

    	return block;
    }

    // (223:7) {#if board[i][j][1] === true }
    function create_if_block_1(ctx) {
    	let if_block_anchor;

    	function select_block_type_3(ctx, dirty) {
    		if (/*board*/ ctx[1][/*i*/ ctx[29]][/*j*/ ctx[32]][0] === 0) return create_if_block_2;
    		if (/*board*/ ctx[1][/*i*/ ctx[29]][/*j*/ ctx[32]][0] > 0) return create_if_block_3;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type_3(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_3(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(223:7) {#if board[i][j][1] === true }",
    		ctx
    	});

    	return block;
    }

    // (228:8) {:else}
    function create_else_block(ctx) {
    	let div;
    	let mounted;
    	let dispose;

    	function contextmenu_handler_4() {
    		return /*contextmenu_handler_4*/ ctx[17](/*i*/ ctx[29], /*j*/ ctx[32]);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "cell bomb svelte-1q7erz3");
    			add_location(div, file, 228, 9, 5537);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (!mounted) {
    				dispose = listen_dev(div, "contextmenu", prevent_default(contextmenu_handler_4), false, true, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(228:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (226:37) 
    function create_if_block_3(ctx) {
    	let div;
    	let t_value = /*board*/ ctx[1][/*i*/ ctx[29]][/*j*/ ctx[32]][0] + "";
    	let t;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[16](/*i*/ ctx[29], /*j*/ ctx[32]);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "class", "cell num svelte-1q7erz3");
    			add_location(div, file, 226, 9, 5407);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);

    			if (!mounted) {
    				dispose = [
    					listen_dev(div, "contextmenu", prevent_default(/*contextmenu_handler_1*/ ctx[12]), false, true, false, false),
    					listen_dev(div, "click", click_handler, false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*board*/ 2 && t_value !== (t_value = /*board*/ ctx[1][/*i*/ ctx[29]][/*j*/ ctx[32]][0] + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(226:37) ",
    		ctx
    	});

    	return block;
    }

    // (224:8) {#if board[i][j][0] === 0}
    function create_if_block_2(ctx) {
    	let div;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "cell empty  svelte-1q7erz3");
    			add_location(div, file, 224, 9, 5298);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (!mounted) {
    				dispose = listen_dev(div, "contextmenu", prevent_default(/*contextmenu_handler*/ ctx[11]), false, true, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(224:8) {#if board[i][j][0] === 0}",
    		ctx
    	});

    	return block;
    }

    // (221:5) {#each row as cell, j}
    function create_each_block_1(ctx) {
    	let if_block_anchor;

    	function select_block_type_1(ctx, dirty) {
    		if (/*state*/ ctx[0] === false) return create_if_block;
    		return create_else_block_2;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(221:5) {#each row as cell, j}",
    		ctx
    	});

    	return block;
    }

    // (219:3) {#each board as row, i}
    function create_each_block(ctx) {
    	let div;
    	let t;
    	let each_value_1 = /*row*/ ctx[27];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			attr_dev(div, "class", "row svelte-1q7erz3");
    			add_location(div, file, 219, 4, 5142);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div, null);
    				}
    			}

    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*board, chord, hideCell, showCell, flagCell, state*/ 123) {
    				each_value_1 = /*row*/ ctx[27];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, t);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(219:3) {#each board as row, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let h3;
    	let t2;
    	let t3;
    	let t4;
    	let div1;
    	let show_if;
    	let t5;
    	let div0;
    	let t6;
    	let div5;
    	let div2;
    	let button0;
    	let t8;
    	let div3;
    	let button1;
    	let t10;
    	let div4;
    	let button2;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (dirty[0] & /*bCount*/ 4) show_if = null;
    		if (/*state*/ ctx[0] === true) return create_if_block_7;
    		if (show_if == null) show_if = !!(/*bCount*/ ctx[2] === 0 && /*checkWin*/ ctx[9]());
    		if (show_if) return create_if_block_8;
    	}

    	let current_block_type = select_block_type(ctx, [-1, -1]);
    	let if_block = current_block_type && current_block_type(ctx);
    	let each_value = /*board*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Minesweeper Svelte";
    			t1 = space();
    			h3 = element("h3");
    			t2 = text("Flags left: ");
    			t3 = text(/*bCount*/ ctx[2]);
    			t4 = space();
    			div1 = element("div");
    			if (if_block) if_block.c();
    			t5 = space();
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t6 = space();
    			div5 = element("div");
    			div2 = element("div");
    			button0 = element("button");
    			button0.textContent = "Solve";
    			t8 = space();
    			div3 = element("div");
    			button1 = element("button");
    			button1.textContent = "Play Again";
    			t10 = space();
    			div4 = element("div");
    			button2 = element("button");
    			button2.textContent = "Next Layer";
    			attr_dev(h1, "class", "game-container svelte-1q7erz3");
    			add_location(h1, file, 206, 1, 4731);
    			attr_dev(h3, "class", "game-container svelte-1q7erz3");
    			add_location(h3, file, 207, 1, 4783);
    			add_location(div0, file, 217, 2, 5105);
    			attr_dev(div1, "class", "game-container svelte-1q7erz3");
    			add_location(div1, file, 209, 1, 4838);
    			attr_dev(button0, "class", "btn svelte-1q7erz3");
    			add_location(button0, file, 255, 3, 6440);
    			add_location(div2, file, 254, 2, 6431);
    			attr_dev(button1, "class", "btn svelte-1q7erz3");
    			add_location(button1, file, 258, 3, 6536);
    			add_location(div3, file, 257, 2, 6527);
    			attr_dev(button2, "class", "btn svelte-1q7erz3");
    			add_location(button2, file, 261, 3, 6615);
    			add_location(div4, file, 260, 2, 6606);
    			attr_dev(div5, "class", "button-container svelte-1q7erz3");
    			add_location(div5, file, 253, 1, 6398);
    			add_location(main, file, 205, 0, 4723);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			append_dev(main, h3);
    			append_dev(h3, t2);
    			append_dev(h3, t3);
    			append_dev(main, t4);
    			append_dev(main, div1);
    			if (if_block) if_block.m(div1, null);
    			append_dev(div1, t5);
    			append_dev(div1, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div0, null);
    				}
    			}

    			append_dev(main, t6);
    			append_dev(main, div5);
    			append_dev(div5, div2);
    			append_dev(div2, button0);
    			append_dev(div5, t8);
    			append_dev(div5, div3);
    			append_dev(div3, button1);
    			append_dev(div5, t10);
    			append_dev(div5, div4);
    			append_dev(div4, button2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(window, "keydown", /*keydown_handler*/ ctx[15], false, false, false, false),
    					listen_dev(button0, "click", /*click_handler_2*/ ctx[22], false, false, false, false),
    					listen_dev(button1, "click", /*endGame*/ ctx[8], false, false, false, false),
    					listen_dev(button2, "click", /*click_handler_3*/ ctx[23], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*bCount*/ 4) set_data_dev(t3, /*bCount*/ ctx[2]);

    			if (current_block_type !== (current_block_type = select_block_type(ctx, dirty))) {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div1, t5);
    				}
    			}

    			if (dirty[0] & /*board, chord, hideCell, showCell, flagCell, state*/ 123) {
    				each_value = /*board*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div0, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);

    			if (if_block) {
    				if_block.d();
    			}

    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);

    	let { state = false } = $$props;
    	let board = [[]];
    	let mines = 80;
    	let bCount = mines;
    	let cellsClicked = [];
    	let move = [0, 0];
    	board = generateBoard(board, [30, 16], mines);
    	board = countNeighbours(board);

    	function showCell(i, j) {
    		if (board[i][j][0] === -1) {
    			$$invalidate(0, state = true);
    		}

    		$$invalidate(1, board[i][j][1] = true, board);

    		if (board[i][j][0] === 0) {
    			for (let k = -1; k <= 1; k++) {
    				for (let y = -1; y <= 1; y++) {
    					try {
    						if (board[i + k][j + y][0] !== -1 && board[i + k][j + y][1] === false) {
    							showCell(i + k, j + y);
    						}
    					} catch(msg) {
    						
    					}
    				}
    			}
    		}
    	}

    	function hideCell(i, j) {
    		$$invalidate(1, board[i][j][1] = false, board);
    		$$invalidate(2, bCount += 1);
    	}

    	function flagCell(i, j) {
    		if (board[i][j][1] !== 'F') {
    			$$invalidate(1, board[i][j][1] = 'F', board);
    			$$invalidate(2, bCount -= 1);
    		}
    	}

    	function chord(row, col) {
    		const dx = [1, 1, 1, 0, 0, -1, -1, -1];
    		const dy = [1, 0, -1, 1, -1, 1, 0, -1];
    		let fcount = 0;

    		if (board[row][col][0] >= 1) {
    			for (let i = 0; i < 8; i++) {
    				let nr = row + dy[i], nc = col + dx[i];

    				if (nr >= 0 && nr < board.length && nc >= 0 && nc < board[row].length) {
    					if (board[nr][nc][1] === 'F') {
    						fcount += 1;
    					}
    				}
    			}
    		}

    		if (fcount === board[row][col][0]) {
    			for (let i = 0; i < 8; i++) {
    				let nr = row + dy[i], nc = col + dx[i];

    				if (nr >= 0 && nr < board.length && nc >= 0 && nc < board[row].length) {
    					if (board[nr][nc][0] === 0) {
    						showCell(nr, nc);
    					}

    					if (board[nr][nc][1] !== 'F') {
    						$$invalidate(1, board[nr][nc][1] = true, board);
    						showCell(nr, nc);
    					}

    					if (board[nr][nc][1] === 'F' && board[nr][nc][0] !== -1) {
    						$$invalidate(0, state = true);
    					}
    				}
    			}
    		}

    		return board;
    	}

    	function newGame() {
    		$$invalidate(0, state = false);
    		$$invalidate(1, board = generateBoard(board, [30, 16], 80));
    		$$invalidate(1, board = countNeighbours(board));
    		$$invalidate(2, bCount = 80);
    		move = [0, 0];
    	}

    	function endGame() {
    		$$invalidate(0, state = true);
    		autoSolve(true, false);
    		newGame();
    	}

    	function checkWin() {
    		for (let i = 0; i < board.length; i++) {
    			for (let j = 0; j < board[i].length; j++) {
    				if (board[i][j][1] === 'F' && board[i][j][0] !== -1) {
    					return false;
    				}

    				if (board[i][j][1] === false) {
    					return false;
    				}
    			}
    		}

    		return true;
    	}

    	move = randomBegin(board);
    	showCell(move[0], move[1]);

    	function autoSolve(oneMove, toggle) {
    		if (toggle) {

    			setTimeout(
    				() => {
    					let possCells = getOpenCells(board);
    					let marked = bombEqualNum(possCells, board);

    					if (marked.length > 0) {
    						for (let i = 0; i < marked.length; i++) {
    							for (let j = 0; j < marked[i].length; j++) {
    								setTimeout(
    									function () {
    										flagCell(marked[i][j][0], marked[i][j][1]);
    									},
    									i
    								);
    							}
    						}
    					} else if (marked.length === 0) {
    						try {
    							let [toFlag, toOpen] = oneDoubleTwoOne(getOpenCells(board), board);

    							if (toFlag.length > 0) {
    								console.table(toFlag);

    								for (let i = 0; i < toFlag.length; i++) {
    									setTimeout(
    										function () {
    											flagCell(toFlag[i][0], toFlag[i][1]);
    										},
    										i
    									);
    								}
    							}

    							if (toOpen.length > 0) {
    								for (let i = 0; i < toOpen.length; i++) {
    									setTimeout(
    										function () {
    											showCell(toOpen[i][0], toOpen[i][1]);
    										},
    										i
    									);
    								}
    							}
    						} catch(msg) {
    							
    						}

    						let [toFlag, toOpen] = oneTwoOne(getOpenCells(board), board);

    						if (toFlag.length > 0) {
    							console.table(toFlag);

    							for (let i = 0; i < toFlag.length; i++) {
    								setTimeout(
    									function () {
    										flagCell(toFlag[i][0], toFlag[i][1]);
    									},
    									i
    								);
    							}
    						}

    						if (toOpen.length > 0) {
    							for (let i = 0; i < toOpen.length; i++) {
    								setTimeout(
    									function () {
    										showCell(toOpen[i][0], toOpen[i][1]);
    									},
    									i
    								);
    							}
    						}
    					}

    					for (let i = 0; i < possCells.length; i++) {
    						setTimeout(
    							function () {
    								chord(possCells[i][0], possCells[i][1]);
    							},
    							i
    						);
    					}

    					if (!oneMove || state) {
    						autoSolve(false, true);
    					}
    				},
    				10
    			);
    		}
    	}

    	const writable_props = ['state'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function contextmenu_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	function contextmenu_handler_1(event) {
    		bubble.call(this, $$self, event);
    	}

    	function contextmenu_handler_2(event) {
    		bubble.call(this, $$self, event);
    	}

    	function contextmenu_handler_3(event) {
    		bubble.call(this, $$self, event);
    	}

    	const keydown_handler = press => {
    		if (press.key === 'Enter') {
    			newGame();
    		}
    	};

    	const click_handler = (i, j) => {
    		chord(i, j);
    	};

    	const contextmenu_handler_4 = (i, j) => {
    		hideCell(i, j);
    	};

    	const contextmenu_handler_5 = (i, j) => {
    		hideCell(i, j);
    	};

    	const click_handler_1 = (i, j) => {
    		showCell(i, j);
    	};

    	const contextmenu_handler_6 = (i, j) => {
    		flagCell(i, j);
    	};

    	const contextmenu_handler_7 = (i, j) => {
    		hideCell(i, j);
    	};

    	const click_handler_2 = () => {
    		autoSolve(false, true);
    	};

    	const click_handler_3 = () => {
    		autoSolve(true, true);
    	};

    	$$self.$$set = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		generateBoard,
    		countNeighbours,
    		randomBegin,
    		getOpenCells,
    		bombEqualNum,
    		randomGuess,
    		oneDoubleTwoOne,
    		oneTwoOne,
    		state,
    		board,
    		mines,
    		bCount,
    		cellsClicked,
    		move,
    		showCell,
    		hideCell,
    		flagCell,
    		chord,
    		newGame,
    		endGame,
    		checkWin,
    		autoSolve
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    		if ('board' in $$props) $$invalidate(1, board = $$props.board);
    		if ('mines' in $$props) mines = $$props.mines;
    		if ('bCount' in $$props) $$invalidate(2, bCount = $$props.bCount);
    		if ('cellsClicked' in $$props) cellsClicked = $$props.cellsClicked;
    		if ('move' in $$props) move = $$props.move;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		state,
    		board,
    		bCount,
    		showCell,
    		hideCell,
    		flagCell,
    		chord,
    		newGame,
    		endGame,
    		checkWin,
    		autoSolve,
    		contextmenu_handler,
    		contextmenu_handler_1,
    		contextmenu_handler_2,
    		contextmenu_handler_3,
    		keydown_handler,
    		click_handler,
    		contextmenu_handler_4,
    		contextmenu_handler_5,
    		click_handler_1,
    		contextmenu_handler_6,
    		contextmenu_handler_7,
    		click_handler_2,
    		click_handler_3
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { state: 0 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get state() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set state(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
