namespace pt {
   export interface TermLike {
      readonly start: number;
      readonly end: number;
   }

}

namespace ss {
   export abstract class Subscript extends pt.Pattern {
      get adbg() { return this.term.adbg; }
      constructor(readonly term: pt.Term) {
         super();
      }
      abstract get start(): number;
      abstract get end(): number;
      abstract update(f: (a: number) => number): this | pt.Term;
      get children() { return [this.term]; }
   }
   enum EntryKind {
      Range = 1,
      Atom = 2,
   }
   type Entry = {
      start: number,
      kind: EntryKind,
   }
   type Entries = Entry[];

   function seek(entries: Entries, start: number) {
      let idx = entries.findIndex(e => e.start == start);
      (idx >= 0).assert();
      return idx;
   }
   function indices(entries: Entries, start: number, end: number) {
      let idx = seek(entries, start);

      /*
     let e = entries[idx];
     if (e.kind == EntryKind.Atom) {
        (start == end).assert();
        (entries[idx + 1].start == start && entries[idx + 1].kind != EntryKind.Atom).assert();
        return [idx];
     }
     (start < end).assert();
     */
      let ret: number[] = [];
      while (true) {
         if (idx == entries.length)
            return ret;
         let e = entries[idx];
         if (e.start >= end) {
            if (start == end) {
               (e.kind == EntryKind.Atom).assert();
               ret.isEmpty().assert();
               return [idx];
            } else return ret;
         }
         if (e.kind == EntryKind.Range) {
            (end > start).assert();
            ret.push(idx);
            idx += 1;
            continue;
         } else {
            (e.kind == EntryKind.Atom).assert();
            (entries[idx + 1].kind != EntryKind.Atom).assert();
            (entries[idx + 1].start == e.start).assert();
            (idx + 2 == entries.length || entries[idx + 2].start > e.start).assert();
            (start < end).assert();
            ret.push(idx + 1);
            idx += 2;
         }
         continue;
      }
   }
   function end(entries: Entries, start: number, end: number) {
      let idx = seek(entries, start);
      if (idx + 1 == entries.length)
         return end;
      (entries[idx + 1].start >= end).assert();
      return entries[idx + 1].start;
   }
   interface Root extends pt.Root {
      subscriptEntries?: Map<pt.Term, Entries>;
   }
   function getEntries(root: Root) {
      if (root.subscriptEntries)
         return root.subscriptEntries;
      let map = new Map<pt.Term, Map<number, boolean>>();
      function asTerm(t: pt.Term) {
         return map.getOrSet(t, () => new Map<number, boolean>());
      }
      for (let [a, b] of root.elements)
         a.visit(p => {
            if (p instanceof pt.Term) {
               asTerm(p).getOrSet(0, () => false);
               return false;
               // 0 to 1.0.
            } else if (p instanceof Subscript) {
               asTerm(p.term).getOrSet(p.start, () => false);
               if (p instanceof Atom)
                  asTerm(p.term).set(p.start, true);
               return false;
            }
            return true;
         })
      root.subscriptEntries = new Map<pt.Term, Entries>();
      for (let [term, e] of map) {
         let eX: Entries = [];
         let eS = e.toArray().sort((a, b) => a[0] - b[0]);
         if (eS.length == 1)
            continue;
         for (let [a, b] of eS) {
            (eX.isEmpty() || eX.last().start < a).assert();
            if (b)
               eX.push({
                  kind: EntryKind.Atom,
                  start: a,
               })
            eX.push({
               kind: EntryKind.Range,
               start: a,
            })
         }
         root.subscriptEntries.set(term, eX);
      }
      return root.subscriptEntries;
   }
   function compact(root: Root) {
      function translate(n: number, entries: Entries) {
         (entries.last().start < 1).assert();
         let step = 1.0 / (entries.length);
         for (let i = 0; i < entries.length; i += 1) {
            if (n < entries[i].start) {
               (i > 0).assert();
               return (i - 1) * step;
            } else if (n == entries[i].start)
               return i * step;
         }
         return 1;
      }
      let map = getEntries(root);
      let eS = root.elements.map(([p, cn]) => {
         p = p.replace0((p) => {
            if (!(p instanceof Subscript))
               return null;
            if (!map.has(p.term))
               return p.term;
            let ss = map.get(p.term);
            return p.update(n => translate(n, ss));
         })
         return [p, cn] as [pt.Pattern, pt.Channel];
      })
      return new pt.Root(...eS) as Root;

   }
   {
      let zuper = pt.Root.prototype.compact;
      pt.Root.prototype.compact = function() {
         let self = this as pt.Root;
         self = zuper.call(self) as pt.Root;
         self = compact(self);
         return self;
      }
   }


   export class Ordered extends Subscript implements pt.StarLike {
      get plength(): "unknown" { return "unknown"; }
      get isStarLike(): true { return true; }
      get adbg() { return super.adbg + ":" + this.start + "-" + this.end + (this.ascending ? "/" : "\\"); }
      constructor(term: pt.Term, readonly start: number,
         readonly end: number, readonly ascending: boolean) {
         super(term);
         (this.start < this.end).assert();
      }
      recast(cS: pt.Pattern[]) {
         if (cS.length != 1)
            return null;
         let c = cS[0];
         if (pt.isTermLike(c)) {
            // squash?
            let start = c.start.lerp(c.end, this.start);
            let end = c.end.lerp(c.start, 1 - this.end);
            (start < end).assert();
            return new Ordered(c.term, start, end, this.ascending) as this;
         }
         else return null;
      }
      isSame(other: pt.Pattern): other is this {
         return other instanceof Ordered && other.start == this.start && other.end == this.end && other.ascending == this.ascending;
      }
      get child() {
         return new Range(this.term, this.start, this.end, "none");
      }
      pop(dir: "left" | "right", root: Root) {
         let entries = getEntries(root).get(this.term);
         if (!entries)
            entries = [{
               start: this.start,
               kind: EntryKind.Range,
            }]
         let divisions = indices(entries, this.start, this.end).map(i => entries[i].start);
         divisions.push(this.end);

         let idx = divisions.indexOf(this.start);
         let jdx = divisions.indexOf(this.end);
         (idx == 0 && jdx == divisions.length - 1).assert();
         (idx >= 0 && jdx >= 0 && idx < jdx).assert();
         let ret: [Subscript, Subscript][] = [];
         if ((dir == "left") == this.ascending) {
            for (let k = idx; k < jdx; k += 1) {
               let start = divisions[k];
               let mp = divisions[k + 1];
               (mp <= this.end && mp > start && start >= this.start).assert();
               let div = start + (mp - start) / 2;
               let lo = new Range(this.term, start, div, "lo");
               let hi = new Ordered(this.term, div, this.end, this.ascending);
               ret.push(dir == "left" ? [lo, hi] : [hi, lo]);
            }
         } else {
            ((dir == "left") != this.ascending).assert();
            for (let k = jdx; k > idx; k -= 1) {
               let end = divisions[k];
               let mp = divisions[k - 1];
               (mp < end && mp >= this.start && end <= this.end).assert();
               let div = end - (end - mp) / 2;
               let lo = new Ordered(this.term, this.start, div, this.ascending);
               let hi = new Range(this.term, div, end, "hi");
               ret.push(dir == "left" ? [hi, lo] : [lo, hi]);
            }
         }
         return ret;
      }
      push(dir: "left" | "right", what: pt.Pattern, root: Root): Ordered {
         if (!(what instanceof Subscript) || what.term != this.term)
            return null;
         if (what instanceof Ordered && this.ascending != what.ascending)
            return null;
         let entries = getEntries(root).get(this.term);
         if (!entries)
            entries = [{
               start: this.start,
               kind: EntryKind.Range,
            }]

         if ((dir == "left") == this.ascending) {
            let idx = seek(entries, this.start);
            if (end(entries, this.start, this.end) == what.start)
               return new Ordered(this.term, this.start, what.end, this.ascending);
            else return null;
         } else {
            ((dir == "left") != this.ascending).assert();
            if (end(entries, what.start, what.end) == this.start)
               return new Ordered(this.term, what.start, this.end, this.ascending);
            else return null;
         }
      }
      update(f: (a: number) => number) {
         return new Ordered(this.term, f(this.start), f(this.end), this.ascending) as this;
      }
      makeRender(parent: ui2.Elem, index: number): OrderedRender {
         return new OrderedRender(parent, index, this);
      }
      randExeme(r: Random, limit: number) {
         return this.term.star().randExeme(r, limit);
      }
      get execEqVal() { return this.term.star().execEqVal; }
      unify(other: pt.Pattern, txt: pt.Unify, root: Root): pt.Unify[] {
         if (other instanceof Ordered) {
            if (this.ascending != other.ascending)
               return []; // XXX: we can actually handle this!
            let start = txt.subscript(this.term, this.start);
            let end = txt.subscript(this.term, this.end);
            if (start != null && start != other.start)
               return [];
            if (end != null && end != other.end)
               return [];
            if (this.start > other.start || this.end < other.end)
               return [];
            txt = start == null ? txt.bindSubscript(this.term, this.start, other.start) : txt;
            txt = end == null ? txt.bindSubscript(this.term, this.end, other.end) : txt;
            return this.term.unify(other.term, txt);
         }
         return super.unify(other, txt, root);
      }
      replace(txt: pt.Unify): pt.Pattern {
         let start = txt.subscript(this.term, this.start);
         let end = txt.subscript(this.term, this.end);
         let term = this.term.replace(txt);
         if (start != null && end != null && term instanceof pt.Term)
            return new Ordered(term, start, end, this.ascending) as this;
         return super.replace(txt);
      }
      buildOptions(parent: pt.Pattern, root: pt.Root) {
         let ret = super.buildOptions(parent, root);
         ret.push(new Ordered(this.term, this.start, this.end, !this.ascending))
         ret.push(this.term);
         return ret;
      }      
   }


   function optionsFor(p: pt.Pattern, path: number[], root: Root): en.Option[] {
      if (!pt.isTermLike(p) || p instanceof Atom)
         return [];
      (path[0] == 0 && path.length >= 2).assert();
      let [a, b] = root.elements[path[1]];

      let entries = getEntries(root).get(p.term);
      if (!entries)
         return [];
      let pp = p;
      let jdx0 = entries.findIndex((c) => c.kind == EntryKind.Atom && c.start > pp.start && c.start < pp.end);
      let start = jdx0 < 0 ? -1 : entries[jdx0].start;
      let jdx = start < 0 ? -1 : root.elements.findIndex(([c, d]) => c instanceof Atom && c.start == start && b.isUnder(d));
      let divide = jdx < 0 ? null : new Divide(b, path, jdx);
      if (divide && divide.transform(root))
         return [divide];
      return [];
   }
   export abstract class RangeAtom extends Subscript implements pt.TermLike {
      get isTermLike(): true { return true; }
      get execEqVal() { return this.term.execEqVal; }
      randExeme(r: Random, limit: number) {
         return this.term.randExeme(r, limit);
      }
      get plength() { return 1; }
   }


   export class Range extends RangeAtom {
      get adbg() { return super.adbg + ":" + this.start + "-" + this.end; }
      constructor(term: pt.Term, readonly start: number, readonly end: number,
         readonly mode: "hi" | "lo" | "none") {
         super(term);
         (this.start < this.end).assert();
         //(this.start != 0 || this.end != 1).assert();
      }
      recast(cS: pt.Pattern[]) {
         if (cS.length == 1 && cS[0] instanceof pt.Term)
            return new Range(cS[0] as pt.Term, this.start, this.end, this.mode) as this;
         else return null;
      }
      isSame(other: pt.Pattern): other is this {
         return other instanceof Range && other.start == this.start &&
            other.end == this.end && other.mode == this.mode;
      }
      split(entries: Entries): Range[] {
         let idxS = indices(entries, this.start, this.end);
         let ret: Range[] = [];
         for (let i = 0; i < idxS.length; i += 1) {
            let e = entries[idxS[i]];
            (i == 0 || entries[idxS[i - 1]].start < e.start).assert();
            let end = i + 1 < idxS.length ? entries[idxS[i + 1]].start : this.end;
            (end > e.start).assert();
            ret.push(new Range(this.term, e.start, end, this.mode));
         }
         return ret;
      }

      update(f: (a: number) => number) {
         let [start, end] = [f(this.start), f(this.end)];
         if (start == 0 && end == 1)
            return this.term;
         return new Range(this.term, start, end, this.mode) as this;
      }

      makeRender(parent: ui2.Elem, index: number): RangeAtomRender {
         return new RangeAtomRender(parent, index, this);
      }
      options(path: number[], root: pt.Root, oprs: [en.Operation, pt.Root][]): en.Option[] {
         let ret = super.options(path, root, oprs);
         ret.push(...optionsFor(this, path, root));
         return ret;
      }
      lift(dir: "front" | "back", root: Root): pt.StarLike {
         if (this.mode == "none")
            return null;
         else if ((this.mode == "hi") == (dir == "back"))
            return new Ordered(this.term, this.start, this.end, true);
         else
            return new Ordered(this.term, this.start, this.end, false);
      }
      buildOptions(parent: pt.Pattern, root: pt.Root) {
         let ret = super.buildOptions(parent, root);
         ret.push(...buildOptions(this, parent, root));
         return ret;
      }
   }
   function buildOptions(self: pt.TermLike, parent: pt.Pattern, root: pt.Root) {
      let ret: pt.Pattern[] = [];
      if (!pt.isStarLike(parent))
         ret.push(new Ordered(self.term, self.start, self.end, true));
      let entries = getEntries(root).get(self.term);
      let idxS = !entries ? null : indices(entries, 0, 1);
      let divs = idxS && idxS.length > 1 ? idxS.map(i => entries[i].start) : null;
      if (divs) {
         divs.push(self.end);
         // replace with seq.
         for (let i = 0; i < divs.length - 1; i += 1) {
            let start = divs[i];
            let end = divs[i + 1];
            ret.push(new Range(self.term, start, end, "none"));
         }
      } else {
         // split.
         let lo = new Range(self.term, self.start, self.start.lerp(self.end, .5), "none");
         let hi = new Range(self.term, lo.end, self.end, "none");
         ret.push(new pt.Seq(lo, hi));
      }
      return ret;
   }


   export class Atom extends RangeAtom {
      get adbg() { return super.adbg; }
      constructor(term: pt.Term, readonly start: number) {
         super(term);
      }
      get end() { return this.start; }
      recast(cS: pt.Pattern[]) {
         if (cS.length == 1 && cS[0] instanceof pt.Term)
            return new Atom(cS[0] as pt.Term, this.start) as this;
         else return null;
      }
      isSame(other: pt.Pattern): other is this {
         return other instanceof Atom && other.start == this.start;
      }
      update(f: (a: number) => number) {
         return new Atom(this.term, f(this.start)) as this;
      }
      makeRender(parent: ui2.Elem, index: number): RangeAtomRender {
         return new RangeAtomRender(parent, index, this);
      }
   }

   function subscriptFor(ui: ptrn.Pattern) {
      let root = (ui.root as ptrn.RootLike).model;
      let term = (ui.model as pt.TermLike).term;
      let entries = getEntries(root).get(term);
      if (!entries)
         return "";
      let start = (ui.model as pt.TermLike).start;
      let end = (ui.model as pt.TermLike).end;
      let idxS = indices(entries, start, end);
      return idxS.format(n => n.toString(), ",");
   }


   class RangeAtomRender extends rn.Term implements ptrn.Pattern {
      get value() { return this.model.term.value; }
      subscript() { return subscriptFor(this); }
      constructor(parent: ui2.Elem, readonly index: number, readonly model: Subscript) {
         super(parent);
      }
      get doDot() { return this.model instanceof Atom; }
   }
   ptrn.Term.prototype.subscript = function () {
      return subscriptFor(this as ptrn.Term);
   }

   class OrderedRender extends rn.Ordered implements ptrn.Pattern {
      get ascending() { return this.model.ascending; }
      constructor(parent: ui2.Elem, readonly index: number, readonly model: Ordered) {
         super(parent);
         if (model.start == 0 && model.end == 1)
            this.children.push(new ptrn.Term(this, 0, model.term));
         else this.children.push(new RangeAtomRender(this, 0, new Range(model.term, model.start, model.end, "none")));


      }
   }

   {
      let zuper = pt.Term.prototype.buildOptions;
      pt.Term.prototype.buildOptions = function (parent, root) {
         let self = this as pt.Term;
         let ret = zuper.call(self, parent, root) as pt.Pattern[];
         ret.push(...buildOptions(self, parent, root));
         return ret;
      }
   }



   export class Pivot extends en.Operation {
      constructor(readonly channel: pt.Channel, readonly idx: number) {
         super();
      }
      get args() { return [this.idx]; }
      get name() { return "pivot"; }
      transform(p: pt.Root) {
         // convert term or range into atom.
         if (this.idx >= p.elements.length)
            return null;
         let [a, b] = p.elements[this.idx];
         if (b != this.channel || !pt.isTermLike(a))
            return null;
         if (a instanceof Atom)
            return null; // already pivot!
         let entries = getEntries(p as Root).get(a.term);
         let jdxS = entries ? indices(entries, a.start, a.end) : [0];
         if (!jdxS || jdxS.length != 1)
            return null;
         let mid = a.start.lerp(a.end, .5);
         let atom = new Atom(a.term, mid);
         return p.splice(this.idx, 1, new pt.Root([atom, this.channel]))
      }
      compile(prevRoot: pt.Root, preStart: number, preEnd: number) {
         // no instructions...perspective change. 
         return true ? [] : super.compile(prevRoot, preStart, preEnd);
      }
   }
   const loDiv = "lo";
   const hiDiv = "hi";

   export class Divide extends en.Operation {
      constructor(readonly channel: pt.Channel, readonly idx: number[], readonly jdx: number) {
         super();
      }
      get args() { return this.idx.skip(1).concat([this.jdx]); }
      get name() { return "divide"; }
      //static readonly TagPrefix = "Divide";
      transform(p: pt.Root) {
         // convert term or range into atom.
         (this.idx.length > 1 && this.idx[0] == 0).assert();
         let b = p.elements[this.idx[1]][1];
         let a = p.access(this.idx);
         if (!(a instanceof pt.Pattern) || b != this.channel ||
            !pt.isTermLike(a) || a instanceof Atom)
            return null;

         let entries = getEntries(p as Root).get(a.term);
         // find atom.
         if (!entries)
            return null;
         {
            let [c, d] = p.elements[this.jdx];
            if (!this.channel.isUnder(d) || !(c instanceof Atom))
               return null;
            if (c.start <= a.start || c.start >= a.end)
               return null;
         }

         let a0 = a instanceof Range ? a : new Range(a.term, a.start, a.end, "none");
         let ranges = entries ? a0.split(entries) : null;
         if (!ranges || ranges.length != 2)
            return null;
         let or = new pt.Or(ranges, [loDiv, hiDiv]);
         return p.update(this.idx, or);
         //.children[this.idx[1]];
         //return p.splice(this.idx[1], 1, new pt.Root([or, this.channel]))
      }
      compile(prevRoot: pt.Root, preStart: number, preEnd: number) {
         // no instructions...perspective change. 
         let ret: ex.Ins[] = [];
         (this.idx[0] == 0).assert();
         let rest = this.idx.slice(2, this.idx.length);
         for (let [cn, idx] of prevRoot.toLocal(this.idx[1] + preStart, this.channel))
            for (let [cn0, jdx] of prevRoot.toLocal(this.jdx + preStart, cn))
               ret.push(new ex.Ins(new DivideCore(rest), cn0, [idx, jdx]));
         return ret;
      }
   }
   class DivideCore extends ex.InsCore {
      get adbg() { return "divide"; }
      get idxC() { return 2; }
      exec(ins: ex.Ins, txt: ex.Context, pc: number): ex.Context {
         let idx = txt.offsets[ins.idxS[1]];
         let value = "" + txt.data[idx];
         let h = value.substr(0, 1);
         let r = pt.convertToNumber(value.substr(1, value.length - 1));
         let cmp = (a: any) => {
            let value0 = "" + a;
            let h0 = value0.substr(0, 1);
            let r0 = pt.convertToNumber(value0.substr(1, value0.length - 1));
            h.equals(h0).assert();
            return r0 - r;
         };
         let replace = txt.exemes[ins.idxS[1]];
         if (!pt.isTermLike(replace.pattern))
            throw new Error();
         let lo = new ex.CustomTerm(replace.pattern.term, "_lo", d => cmp(d) <= 0);
         let hi = new ex.CustomTerm(replace.pattern.term, "_hi", d => cmp(d) > 0);
         let or = new ex.ComputedOr([lo, hi], [loDiv, hiDiv]);
         let exemes = txt.exemes.copy();
         exemes[ins.idxS[0]] = exemes[ins.idxS[0]].update(this.rest, 0, (a, path, at) => {
            if (path.length == at) {
               if (!a.pattern.execEquals(replace.pattern))
                  throw new Error();
               return or;
            } else if (a instanceof ex.EmptyStar || a instanceof ex.EmptyOpt) {
               (path[at] == 0).assert();
               let b = a.pattern.child.updateP(path.slice(at + 1, path.length), 0, new pt.Or([replace.pattern, replace.pattern], [loDiv, hiDiv]));
               return a instanceof ex.EmptyStar ? new ex.EmptyStar(b.star()) : new ex.EmptyOpt(b.opt());
            }
            throw new Error();
         })
         return new ex.Context(txt.start, txt.end, txt.data, exemes, txt.channel, txt.unify, txt.trace);
      }
      constructor(readonly rest: number[]) {
         super();
      }

   }

   let superOptions = pt.Root.prototype.options;
   pt.Root.prototype.options = function (idx, db, oprs) {
      let self = this as pt.Root;
      let options = superOptions.call(self, idx, db, oprs);
      let [a, b] = self.elements[idx];
      if (pt.isTermLike(a)) {
         let pivot = new Pivot(b, idx);
         if (pivot.transform(self))
            options.push(pivot);
      }
      return options;
   }
   pt.Term.prototype.options = function (path, root, oprs) {
      let self = this as pt.Term;
      let ret = pt.Pattern.prototype.options.call(self, path, root, oprs);
      ret.push(...optionsFor(self, path, root));
      return ret;
   }



}

namespace pt {
   //export interface TermLike extends ss.SubscriptLike { }
}