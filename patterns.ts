namespace pt {
   export abstract class BasePattern {
      abstract get children(): Pattern[];
      abstract get adbg(): string;
      toString() { return this.adbg; }
      parenString() {
         if (this.hasParen)
            return "(" + this.adbg + ")";
         else return this.adbg;
      }
      get hasParen() { return false; }

      abstract get plength(): number | "unknown";
      abstract equals(other: BasePattern, strict?: "yes" | "no"): boolean;
      abstract recast(children: Pattern[]): this;
      reverse(): this {
         let cS = this.children.map(c => c.reverse());
         cS.reverse();
         return this.recast(cS) as this;
      }

   }
}
namespace pt {
   export type OrTag = string;

   export abstract class Unify extends Object {
      abstract get adbg(): string;
      toString() { return this.adbg; }
      constructor() { super(); }
      abstract term(from: Term): Pattern;
      abstract orTag(from: OrTag): OrTag;
      abstract subscript(term: Term, n: number): number;

      bindTerm(from: Term, to: Pattern): Unify {
         let exist = this.term(from);
         if (!exist)
            return new TermUnify(this, from, to);
         else if (exist.equals(to))
            return this;
         else return null;
      }
      bindOrTag(from: OrTag, to: OrTag): Unify {
         let exist = this.orTag(from);
         if (!exist)
            return new OrUnify(this, from, to);
         else if (exist.equals(to))
            return this;
         else return null;
      }
      bindSubscript(term: Term, from: number, to: number) {
         return new SubscriptUnify(this, term, from, to);
      }
      doConsolidate(): Unify {
         let ret = new ConsolidatedUnify();
         let at: Unify = this;
         while (at instanceof ChildUnify) {
            if (at instanceof TermUnify)
               ret.terms.set(at.from, at.to);
            else if (at instanceof OrUnify)
               ret.ors.set(at.from, at.to);
            else if (at instanceof SubscriptUnify)
               ret.subscripts.getOrSet(at.xterm, () => new Map<number, number>()).set(at.from, at.to);
            else throw new Error();
            at = at.previous;
         }
         if (at instanceof ConsolidatedUnify) {
            for (let [a, b] of at.terms)
               ret.terms.set(a, b);
            for (let [a, b] of at.ors)
               ret.ors.set(a, b);
            for (let [t, m] of at.subscripts) {
               if (!ret.subscripts.has(t))
                  ret.subscripts.set(t, m);
               else {
                  let m0 = ret.subscripts.get(t);
                  for (let [a, b] of m)
                     m0.set(a, b);
               }
            }
         }
         return ret;
      }
      compose(inner: Unify) {
         return new ComposeUnify(this, inner);
      }
   }
   export class RootUnify0 extends Unify {
      get adbg() { return "root"; }
      term(from: Term): Pattern { return null; }
      orTag(from: OrTag): OrTag { return null; }
      subscript(term: Term, n: number): number { return null; }
   }
   abstract class ChildUnify extends Unify {
      get adbg() { return this.previous.adbg; }
      constructor(readonly previous: Unify) { super(); }
      term(from: Term): Pattern { return this.previous.term(from); }
      orTag(from: OrTag): OrTag { return this.previous.orTag(from); }
      subscript(term: Term, n: number): number { return this.previous.subscript(term, n); }
   }
   class ComposeUnify extends Unify {
      get adbg() { return "compose(" + this.outer + ", " + this.inner + ")"; }
      constructor(readonly outer: Unify, readonly inner: Unify) {
         super();
         (outer instanceof ComposeUnify || outer instanceof ConsolidatedUnify || outer == RootUnify).assert();
         (inner instanceof ConsolidatedUnify || inner == RootUnify).assert();
      }
      term(term: Term) {
         let p = this.inner.term(term);
         let q = p ? p.replace(this.outer) : null;
         return q ? q : p;
      }
      orTag(tag: OrTag) {
         let p = this.inner.orTag(tag);
         let q = p ? this.outer.orTag(p) : null;
         return q ? q : p;
      }
      subscript(term: Term, n: number): number {
         let p = this.inner.subscript(term, n);
         let q = p != null ? this.outer.subscript(term, p) : null;
         return q ? q : p;
      }
   }


   abstract class BindUnify<T extends {
      equals(other: T): boolean;
   }, S> extends ChildUnify {
      get adbg() { return "[" + this.from + "->" + this.to + "]"; }
      constructor(previous: Unify, readonly from: T, readonly to: S) {
         super(previous);
      }
      protected lookup(from: T): S {
         if (this.from.equals(from))
            return this.to;
         else return null;
      }

   }
   class TermUnify extends BindUnify<Term, Pattern> {
      term(from: Term) { return this.from.equals(from) ? this.to : super.term(from); }
   }
   class OrUnify extends BindUnify<OrTag, OrTag> {
      orTag(from: OrTag) { return this.from == (from) ? this.to : super.orTag(from); }
   }
   class SubscriptUnify extends ChildUnify {
      get adbg() { return "[" + this.xterm + ":" + this.from + "->" + this.to + "]"; }
      constructor(previous: Unify, readonly xterm: Term, readonly from: number, readonly to: number) {
         super(previous);
      }
      subscript(term: Term, from: number) {
         if (term == this.xterm && from == this.from)
            return this.to;
         else return super.subscript(term, from);
      }

   }
   class ConsolidatedUnify extends Unify {
      readonly terms = new Map<Term, Pattern>();
      readonly ors = new Map<OrTag, OrTag>();
      readonly subscripts = new Map<Term, Map<number, number>>();
      get adbg() { return "[" + this.terms.format(([a, b]) => a + "->" + b) + "][" + this.ors.format(([a, b]) => a + "->" + b) + "]"; }
      doConsolidate() { return this; }
      term(from: Term) {
         if (this.terms.has(from))
            return this.terms.get(from);
         else return null;
      }
      orTag(from: OrTag) {
         if (this.ors.has(from))
            return this.ors.get(from);
         else return null;
      }
      subscript(term: Term, n: number): number {
         let m0 = this.subscripts.get(term);
         let m1 = m0 ? m0.get(n) : null;
         return m1;
      }


   }
   export const RootUnify: Unify = new RootUnify0();
}
namespace pt {
   export abstract class Pattern extends BasePattern {
      opt() { return new Opt(this); }
      star() { return new Star(this); }
      protected static readonly orKeys = new Map<string, number>();


      or(key: string | string[] | null, ...children: Pattern[]) {
         children.splice(0, 0, this);
         let nS: string[] = [];
         if (key == null) {
            let len = children.map(c => c instanceof pt.Or ? c.children.length : 1).sum();
            for (let i = 0; i < len; i += 1)
               nS.push("K" + i);
         }
         else if (typeof key == "string") {
            let start = Pattern.orKeys.getOrSet(key, () => 0);
            for (let i = 0; i < children.length; i += 1)
               nS.push(key + (start + i));
            Pattern.orKeys.set(key, start + children.length);
         } else nS = key;
         return new Or(children, nS);
      }
      seq(...children: Pattern[]) {
         children.splice(0, 0, this);
         return new Seq(...children);
      }
      abstract isSame(other: BasePattern): other is this;
      equals(other: BasePattern, strict: "yes" | "no" = "yes"): boolean {
         if (!this.isSame(other) || this.children.length != other.children.length)
            return false;
         for (let i = 0; i < other.children.length; i += 1)
            if (!this.children[i].equals(other.children[i], strict))
               return false;
         return true;
      }
      execEquals(other: Pattern) {
         return this.execEqVal.equals(other.execEqVal, "no");
      }
      get execEqVal(): Pattern { return this.recast(this.children.map(c => c.execEqVal)); }
      unifyAll(other: Pattern, txtS: Unify[], root: Root): Unify[] {
         return flatten<Unify>(txtS.map(txt => this.unify(other, txt, root))).toArray();
      }
      unify(other: Pattern, txt: Unify, root: Root): Unify[] {
         if (!this.isSame(other))
            return [];
         if (this.children.length != other.children.length)
            return [];
         let txtS: Unify[] = [txt];
         for (let i = 0; i < this.children.length; i += 1) {
            if (txtS.length == 0)
               break;
            txtS = this.children[i].unifyAll(other.children[i], txtS, root);
         }
         return txtS;
      }
      replace0(f: (a: Pattern) => Pattern): Pattern {
         let e = f(this);
         if (e != null)
            return e;
         let cS: pt.Pattern[] = [];
         for (let c of this.children) {
            let c0 = c.replace0(f);
            if (!c0)
               return null;
            else cS.push(c0);
         }
         return this.recast(cS);
      }
      replace(txt: Unify): Pattern {
         let cS: pt.Pattern[] = [];
         for (let c of this.children) {
            let c0 = c.replace(txt);
            if (!c0)
               return null;
            else cS.push(c0);
         }
         return this.recast(cS);
      }
      visit(f: (p: Pattern) => boolean) {
         if (!f(this))
            return;
         for (let c of this.children)
            c.visit(f);
      }
      identify(f: (p: Pattern) => (true | false | "stop"), idx: number[], ret: number[][]) {
         let ret0 = f(this);
         if (ret0 == "stop")
            return;
         else if (ret0 == true) {
            ret.push(idx);
            return;
         } else (ret0 == false).assert();
         for (let i = 0; i < this.children.length; i += 1) {
            let path = idx.concat(...[i]);
            this.children[i].identify(f, path, ret);
         }
      }
      lift(dir: "front" | "back", root: Root): StarLike {
         return this.star();
      }
      accessP(path: number[], at: number, limit?: number): Pattern {
         if (limit == undefined)
            limit = path.length;
         if (at == limit)
            return this;
         else return this.children[path[at]].accessP(path, at + 1, limit);
      }
      updateP(path: number[], at: number, p: pt.Pattern): Pattern {
         if (at == path.length)
            return p;
         let updated = this.children[path[at]].updateP(path, at + 1, p);
         if (updated == null)
            return null;
         let cS = this.children.copy();
         cS[path[at]] = updated;
         return this.recast(cS);
      }

      rectify(other: Pattern, root: Root): Unify {
         let txt0 = RootUnify;
         this.visit(p => {
            if (p instanceof pt.Term)
               txt0 = txt0.bindTerm(p, p);
            return true;
         })
         let txtS = this.unify(other, txt0, root);
         if (txtS.length > 1)
            return null;
         for (let txt of txtS) {
            let self = this.replace(txt);
            if (self && self.equals(other, "no"))
               return txt;

         }
         return null;
      }

   }
}
namespace pt {
   export interface TermLike extends Pattern {
      readonly isTermLike: true;
      readonly term: Term;
   }
   export function isTermLike(other: pt.Pattern): other is TermLike {
      return (other as TermLike).isTermLike;
   }

   export class Term extends Pattern implements TermLike {
      get isTermLike(): true { return true; }
      get term() { return this; }
      recast(): this { return this; }
      get children(): Pattern[] { return []; }
      get adbg() { return this.value; }
      constructor(readonly value: string, readonly isSingle = true) { super(); }
      get plength() { return this.isSingle ? 1 : "unknown"; }
      equals(other: BasePattern): other is this { return other === this; }
      isSame(other: BasePattern): other is this { return other instanceof Term && other.isSingle == this.isSingle; };

      unify(other: Pattern, txt: Unify): Unify[] {
         if (false && this == other)
            return [txt];
         let exist = txt.term(this);
         if (exist) {
            if (other.equals(exist))
               return [txt];
            else return [];
         }
         else if (this.isSingle && other.plength != 1)
            return [];
         else return [txt.bindTerm(this, other)];
      }
      replace(txt: Unify): Pattern {
         let exist = txt.term(this);
         return exist ? exist : this;
      }
      get start() { return 0; }
      get end() { return 1; }
   }
   export abstract class OrSeq extends Pattern {
      private readonly children0: Pattern[] = [];
      get children() { return this.children0; }
      constructor(...children: Pattern[]) {
         super();
         for (let c of children)
            if (this.isSame(c))
               this.children.push(...c.children);
            else if (c.plength == 0)
               (this instanceof Seq).assert();
            else this.children.push(c);
      }
      get sep() { return ""; }
      get adbg() { return this.children.format(c => c.parenString(), this.sep); }
      get hasParen() { return this.children.length != 1; }
      isSame(other: BasePattern): other is this { return other instanceof OrSeq };
   }
   export class Seq extends OrSeq {
      unifyTop(other: Pattern, txt: Unify) {
         return this.unify(other, txt, Root.make(...this.children));
      }
      equals(other: Pattern, strict: "yes" | "no" = "yes"): other is this {
         return super.equals(other, strict);
      }
      isSame(other: BasePattern): other is this { return other instanceof Seq };
      recast(children: Pattern[]): this {
         return new Seq(...children) as this;
      }
      get plength() {
         let n = 0;
         for (let a of this.children) {
            let m = a.plength;
            if (m == "unknown")
               return "unknown";
            else n += m;
         }
         return n;
      }
      hashInput(rev = false) {
         let seq = this;
         if (rev)
            seq = seq.reverse();
         return seq.replace0(p => {
            if (p.plength == 1)
               return pt.smallY;
            else return null;
         }).toString();
      }
      seq(...cS: Pattern[]): Seq {
         let newC = this.children.copy();
         newC.push(...cS);
         return new Seq(...newC);
      }
   }

   export class Or extends OrSeq {
      isSame(other: BasePattern): other is this { return other instanceof Or };
      get sep() { return " | "; }
      constructor(children: Pattern[], readonly tags: OrTag[]) {
         super(...children);
         if (this.tags.length != this.children.length) {
            (children.length == tags.length && this.tags.length == tags.length).assert();
            this.tags = this.children.map((v,i) => "K" + i);
         }
         for (let i = 0; i < this.tags.length; i += 1)
            while (this.tags.indexOf(this.tags[i]) < i)
               this.tags[i] += i;

         (this.tags.length == this.children.length).assert();
      }
      get plength() {
         if (this.children.length == 0)
            return 0;
         let k = this.children[0].plength;
         if (k == "unknown")
            return "unknown";
         for (let a of this.children.skip(1)) {
            let m = a.plength;
            if (m == "unknown" || k != m)
               return "unknown";
         }
         return k;
      }
      equals(other: BasePattern, strict: "yes" | "no" = "yes"): other is this {
         if (!this.isSame(other) || this.children.length != other.children.length)
            return false;
         for (let i = 0; i < this.children.length; i += 1) {
            let a = this.children[i];
            if (!other.children.some((b, j) => b.equals(a, strict) && (strict != "yes" || this.tags[i].equals(other.tags[j]))))
               return false;
         }
         return true;
      }
      recast(children: Pattern[]): this {
         return new Or(children, this.tags) as this;
      }
      reverse(): this {
         let cS = this.children.map(c => c.reverse());
         return new Or(cS, this.tags) as this;
      }
      replace(txt: Unify): Pattern {
         let ret = super.replace(txt);
         if (ret instanceof Or) {
            (ret.children.length == this.tags.length).assert();
            let tS = this.tags.map(t => {
               let t0 = txt.orTag(t);
               return t0 ? t0 : t;
            })
            return new Or(ret.children, tS);
         } else return ret;
      }
      unify(other: Pattern, txt: Unify, root: Root): Unify[] {
         if (!this.isSame(other))
            return [];
         else if (this.children.length != other.children.length)
            return [];
         // generate all possible combination.
         let txtS: [Unify[], OrTag[]][] = [[[txt], []]];
         for (let i = 0; !txtS.isEmpty() && i < this.children.length; i += 1) {
            let txtN: [Unify[], OrTag[]][] = [];
            for (let j = 0; j < other.children.length; j += 1) {
               for (let [a, b] of txtS) {
                  (b.length == i).assert();
                  if (b.indexOf(other.tags[j]) >= 0)
                     continue;
                  (!a.isEmpty()).assert();
                  let na = this.children[i].unifyAll(other.children[j], a, root);
                  if (na.isEmpty())
                     continue;
                  let nb = b.copy();
                  (nb.length == b.length).assert();
                  nb.push(other.tags[j]);
                  (nb.length == i + 1).assert();
                  txtN.push([na, nb])
               }
            }
            txtS = txtN;
         }
         let txtSS = flatten(txtS.mapi(([txtS, b]) => {
            return txtS.mapi(txt => {
               for (let i = 0; txt && i < this.tags.length; i += 1)
                  txt = txt.bindOrTag(this.tags[i], b[i]);
               return txt;
            }).filteri(txt => txt != null);
         })).toArray();
         if (txtSS.length > 1)
            true.assert();
         for (let txt of txtSS)
            this.replace(txt).equals(other).assert();


         return txtSS;
      }
      or(key: string | string[], ...cS: Pattern[]) {

         let newC = this.children.copy();
         let newT = this.tags.copy();
         let nS: string[] = [];
         if (key == null) {
            let len = cS.map(c => c instanceof pt.Or ? c.children.length : 1).sum();
            for (let i = 0; i < len; i += 1)
               nS.push("K" + i);
         }
         else if (typeof key == "string") {
            let start = Pattern.orKeys.getOrSet(key, () => 0);
            for (let i = 0; i < cS.length; i += 1)
               nS.push(key + (start + i));
            Pattern.orKeys.set(key, start + cS.length);
         } else nS = key;
         newC.push(...cS);
         newT.push(...nS);
         return new Or(newC, newT);
      }
   }
   export abstract class Single extends Pattern {
      isSame(other: BasePattern): other is this { return other instanceof Single };
      get child(): Pattern { return this.child0; }
      get children() { return [this.child]; }
      constructor(readonly child0: Pattern) {
         super();
      }
      abstract get end(): string;
      get adbg() { return this.child.parenString() + this.end; }
   }
   export class Opt extends Single {
      get isOpt(): true { return true; }
      isSame(other: BasePattern): other is this { return other instanceof Opt };
      get end() { return "?"; }
      recast(children: Pattern[]): this {
         if (children.length == 0)
            return new Opt(new Seq()) as this;
         else if (children.length == 1)
            return new Opt(children[0]) as this;
         else throw new Error();
      }
      get plength() {
         let n = this.child.plength;
         if (n == 0)
            return 0;
         else return "unknown";
      }
   }
   export interface StarLike extends Pattern {
      readonly isStarLike: true;
      pop(dir: "left" | "right", root: Root): [Pattern, Pattern][];
      push(dir: "left" | "right", what: pt.Pattern, root: Root): StarLike;
      readonly child: Pattern;
   }
   export function isStarLike(other: Pattern): other is StarLike {
      if ((other as StarLike).isStarLike)
         return true;
      else return false;
   }
   // export abstract class StarLike extends Single { }
   export class Star extends Single implements StarLike {
      get isStarLike(): true { return true; }
      get isStar(): true { return true; }
      isSame(other: BasePattern): other is this { return other instanceof Star };
      get end() { return "*"; }
      recast(children: Pattern[]): this {
         if (children.length == 0)
            return new Star(new Seq()) as this;
         else if (children.length == 1)
            return new Star(children[0]) as this;
         else throw new Error();
      }
      get plength() {
         let n = this.child.plength;
         if (n == 0)
            return 0;
         else return "unknown";
      }
      pop(dir: "left" | "right", root: Root): [Pattern, Pattern][] {
         if (dir == "left")
            return [[this.child, this]];
         else return [[this, this.child]];
      }
      push(dir: "left" | "right", what: Pattern, root: Root) {
         if (what.equals(this.child))
            return this;
         else return null;
      }
      lift(dir: "front" | "back", root: Root) {
         return this;
      }
   }







}

namespace pt {
   export abstract class Channel extends Object {
      abstract get name(): string;
      get adbg(): string { return this.name; }
      toString() { return this.adbg; }
      abstract get parent(): Channel;
      abstract get depth(): number;
      isUnder(c: Channel): boolean {
         if (this == c)
            return true;
         else if (this.parent)
            return this.parent.isUnder(c);
         else return false;
      }
      isRelated(c: Channel) {
         return this.isUnder(c) || c.isUnder(this);
      }
      abstract get color(): RGB;
      //abstract do(child: Pattern): Pattern;
      abstract peers(): Iterable<Channel>;
      get isBranch() { return false; }
      chain(): Iterable<Channel> {
         let ret: Channel[] = [];
         let p: Channel = this;
         while (p) {
            ret.unshift(p);
            p = p.parent;
         }
         return ret;
      }
      branch(...on: [string, RGB][]): Channel[] {
         let group = new GroupChannels(this);
         let ret: Channel[] = [];
         for (let [n, c] of on) {
            let b = new BranchChannel(group, c, n);
            ret.push(b);
         }
         return ret;
      }
      eliminate(): (c: Channel) => Channel {
         throw new Error();
      }
      abstract reparent(p: Channel): [Channel, Channel][];
      common(b: Channel) {
         let a: Channel = this;
         while (a.depth > b.depth)
            a = a.parent;
         while (b.depth > a.depth)
            b = b.parent;
         (a.depth == b.depth).assert();
         while (a != b) {
            a = a.parent;
            b = b.parent;
         }
         return a;
      }
      get isLoop() { return this instanceof LoopChannel; }
      get loopParent(): LoopChannel {
         for (let p: Channel = this; p != pt.RootChannel; p = p.parent) {
            if (p instanceof LoopChannel)
               return p;
         }
         return null;
      }
      get nonLoopParent(): Channel {
         for (let p = this.parent; true; p = p.parent)
            if (!(p instanceof LoopChannel))
               return p;
      }
      toStar(to: Channel, seen: Set<Channel>): Channel | null {
         let use: Channel;
         if (this.isUnder(to))
            use = this;
         else if (to.isUnder(this))
            use = to;
         else return null;
         for (let x of seen) {
            if (use.isUnder(x))
               return null;
            else if (x.isUnder(use)) {
               for (let p of x.peers()) {
                  if (!seen.has(p))
                     use = p;
               }
            }
         }
         return use;

         return use;


      }

   }
   // always black!
   class RootChannel0 extends Channel {
      get name() { return "root"; }
      get parent(): Channel { return null; }
      get depth() { return 0; }
      get color() { return RGB.black; }
      do(child: BasePattern) { return child; }
      peers(): Iterable<Channel> { return []; }
      reparent(): [Channel, Channel][] { throw new Error(); }
   }
   export const RootChannel: Channel = new RootChannel0();

   class GroupChannels extends Object {
      readonly inGroup: (BranchChannel)[] = [];
      constructor(readonly parent: Channel) {
         super();
      }
   }
   abstract class ChildChannel extends Channel {
      readonly depth: number;
      constructor(parent: Channel) {
         super();
         this.depth = parent.depth + 1;
      }
   }
   class BranchChannel extends ChildChannel {
      get parent() { return this.group.parent; }
      constructor(readonly group: GroupChannels, readonly color: RGB, readonly name: string) {
         super(group.parent);
         this.group.inGroup.push(this);
      }
      //do(child: Pattern): DoChannel { return new DoChannel(child, this); }
      peers(): Iterable<Channel> {
         let ret: Channel[] = [];
         for (let e of this.group.inGroup)
            if (e != this)
               ret.push(e);
         return ret;
      }
      get isBranch() { return true; }
      eliminate(): (c: Channel) => Channel {
         let f: (c: Channel) => Channel;
         let map = new Map<Channel, Channel>();
         if (this.group.inGroup.length == 2)
            map.set(this.peers().first(), this.parent);
         else {
            let newGroup = new GroupChannels(this.group.parent);
            for (let p of this.group.inGroup)
               if (p != this) {
                  let q = new BranchChannel(newGroup, p.color, p.name);
                  map.set(p, q);
               }
         }
         f = (c) => {
            (c != this).assert();
            if (c == this.parent || !c.isUnder(this.parent))
               return c;
            if (!map.has(c)) {
               let p = f(c.parent);
               for (let [a, b] of c.reparent(p))
                  map.set(a, b);
            }
            map.has(c).assert();
            return map.get(c);
         }
         return f;
      }
      reparent(p: Channel): [Channel, Channel][] {
         let group = new GroupChannels(p);
         let ret: [Channel, Channel][] = [];
         for (let p of this.group.inGroup)
            ret.push([p, new BranchChannel(group, this.color, this.name)]);
         return ret;
      }
   }
   const available: [string, RGB][] = [
      ["red", RGB.red.lerp(RGB.black, .125)],
      ["blue", RGB.dodgerblue],
      ["purple", RGB.magenta],
      ["orange", RGB.orange],
      ["green", RGB.green.lerp(RGB.lime, .5).lerp(RGB.black, .25)],
      ["grey", RGB.grey],
      ["cadet", RGB.cadetblue],
      ["golden", RGB.golden],
      ["slate", RGB.darkslateblue],
      ["pink", RGB.pink],
   ]

   export function selectNewChannels(used: Set<string>, input: Channel, kind: "loop" | number, expected?: Seq) {
      if (kind == 2) {
         if (input == pt.RootChannel || (input instanceof LoopChannel && input == RootChannel)) {
            if (!used.has("red") && !used.has("blue"))
               return input.branch(available[0], available[1]);
         }
         if (input.name == "red" && !used.has("purple") && !used.has("orange"))
            return input.branch(available[2], available[3]);
         if (input.name == "blue" && !used.has("cadet") && !used.has("grey"))
            return input.branch(available[5], available[6]);
      }
      if (kind == "loop") {
         if (input == pt.RootChannel && !used.has("green"))
            return [new LoopChannel(input, available[4][1], available[4][0])];
      }
      // just allocate.
      let opts = available.filteri(([a, b]) => !used.has(a)).take(kind == "loop" ? 1 : kind).toArray();
      if (kind == "loop") {
         (opts.length == 1).assert();
         return [new LoopChannel(input, opts[0][1], opts[0][0])];
      } else {
         (opts.length == kind).assert();
         return input.branch(...opts);
      }
   }


   export class LoopChannel extends ChildChannel {
      readonly shadow: LoopShadow;
      constructor(
         readonly parent: Channel, readonly color: RGB, readonly name: string,
         /*readonly expected: Seq*/) {
         super(parent);
         //(!(this.expected instanceof pt.Root)).assert();
         this.shadow = new LoopShadow(this);
      }
      peers(): Iterable<Channel> { return [this.shadow]; }
      get isBranch() { return false; }
      reparent(p: Channel): [Channel, Channel][] {
         return [[this, new LoopChannel(p, this.color, this.name)]]
      }
   }
   export class LoopShadow extends ChildChannel {
      get parent() { return this.loop.parent; }
      constructor(readonly loop: LoopChannel) {
         super(loop.parent);
      }
      get color() { return RGB.wheat; }
      get name() { return this.loop.name + "-shadow"; }
      peers(): Iterable<Channel> { return [this.loop]; }
      get isBranch() { return false; }
      reparent(p: Channel): [Channel, Channel][] {
         throw new Error();
      }
   }


   export type RootElem = [Pattern, Channel];



   export class Root extends BasePattern {
      isValid() {
         for (let [a, b] of this.elements)
            if (b instanceof LoopShadow)
               return false;
         return true;
      }
      static readonly Empty = Root.make();


      readonly elements: RootElem[] = [];
      static make(...elems: Pattern[]) {
         return new Root(...elems.map(a => [a, RootChannel] as [Pattern, Channel]));
      }
      asSeq() { return new Seq(...this.children); }
      constructor(...elems: [Pattern, Channel][]) {
         super();

         for (let [a, b] of elems) {
            if (a instanceof Seq) {
               for (let c of a.children)
                  this.elements.push([c, b]);
            } else if (a.plength == 0) { }
            else this.elements.push([a, b]);
         }
      }
      get children() { return this.elements.map(c => c[0]); }
      get plength() {
         let n = 0;
         for (let a of this.children) {
            let m = a.plength;
            if (m == "unknown")
               return "unknown";
            else n += m;
         }
         return n;
      }
      get adbg() {
         let i = 0;
         let str = "";
         while (i < this.elements.length) {
            let cn = this.elements[i][1];
            let j = i;
            while (j < this.elements.length && this.elements[j][1] == cn)
               j += 1;
            (j > i).assert();
            let inner = this.elements.slice(i, j).format(a => a[0].adbg, "");
            if (cn == pt.RootChannel)
               str += inner;
            else str += ":" + cn + "[" + inner + "]";
            i = j;
         }
         return str;


      }
      equals(other: BasePattern): other is this {
         if (!(other instanceof Root))
            return false;
         if (this.elements.length != other.elements.length)
            return false;
         for (let i = 0; i < this.elements.length; i += 1) {
            if (this.elements[i][1] != other.elements[i][1])
               return false;
            if (!this.elements[i][0].equals(other.elements[i][0]))
               return false;
         }
         return true;
      }
      recast(): this { throw new Error(); }
      reverse(): this {
         let eS = this.elements.map(([a, b]) => [a.reverse(), b] as [Pattern, Channel]);
         eS = eS.reverse();
         return new Root(...eS) as this;
      }
      slice(start: number, end: number) {
         return new Root(...this.elements.slice(start, end));
      }
      splice(start: number, length: number, insert?: Root) {
         if (length == 0 && (!insert || insert.elements.length == 0))
            return this;
         let eS = this.elements.copy();
         eS.splice(start, length, ...(insert ? insert.elements : []));
         return new Root(...eS);
      }
      filter(cn: Channel) {
         let eS: [Pattern, Channel][] = [];
         for (let [a, b] of this.elements) {
            if (!b.isRelated(cn))
               continue;
            let b0 = b.isUnder(cn) ? b : cn;
            eS.push([a, b0]);
         }
         return new Root(...eS);
      }
      private split0(cn: Channel): Root {
         if (cn == RootChannel)
            return this;
         let self = cn.parent ? this.split0(cn.parent) : this;
         (!cn.peers().isEmpty()).assert();
         let eS: [Pattern, Channel][] = self.filter(cn).elements.copy();
         for (let peer of cn.peers())
            eS.push(...self.filter(peer).elements);
         for (let [a, b] of self.elements)
            if (!b.isRelated(cn.parent))
               eS.push([a, b]);
         return new Root(...eS);
      }
      split(cn: Channel, start: number, length: number): Root {
         let slice = this.slice(start, start + length);
         slice = slice.split0(cn);
         return this.splice(start, length, slice);
      }
      splits(cn: Channel, cS: [number, number][]): Root {
         let self: Root = this;
         let added = 0;
         for (let i = 0; i < cS.length; i += 1) {
            cS[i][0] += added;
            let newSelf = self.split(cn, cS[i][0], cS[i][1]);
            added += (newSelf.elements.length - self.elements.length);
            self = newSelf;
         }
         return self;
      }

      toLocal(global: number, cn: Channel): [Channel, number][] {
         let local = 0;
         let ret: [Channel, number][] = [];
         for (let i = 0; i < global; i += 1) {
            if (cn.isUnder(this.elements[i][1]))
               local += 1;
            else if (this.elements[i][1].isUnder(cn)) {
               let cn0 = this.elements[i][1];
               while (cn0.parent != cn)
                  cn0 = cn0.parent;
               return flatten([cn0].concati(cn0.peers()).mapi(c => this.toLocal(global, c))).toArray();
            }
         }
         (local <= global).assert();
         return [[cn, local]];
      }
      merge(): Root {
         let self: Root = this;
         while (true) {
            let changed = false;
            for (let i = 0; !changed && i < self.elements.length; i += 1) {
               let [a, b] = self.elements[i];
               if (b.peers().isEmpty())
                  continue;
               let peerLen = b.peers().count() + 1;
               let peers: [number, pt.Channel][] = [[i, b]];
               for (let j = i + 1; !changed && j < self.elements.length; j += 1) {
                  let [c, d] = self.elements[j];
                  if (a.equals(c) && d.parent == b.parent) {
                     if (peers.findIndex(x => x[1] == d) >= 0)
                        break;
                     peers.push([j, d]);
                     if (peers.length == peerLen) {
                        // figure out a center.
                        for (let k = 0; !changed && k < peers.length; k += 1) {
                           let kdx = peers[k][0];
                           // none of the other peers can have related to k.
                           let fail = false;
                           for (let h = 0; !fail && h < k; h += 1) {
                              let [hdx, hc] = peers[h];
                              (hdx < kdx).assert();
                              for (let g = hdx + 1; !fail && g < kdx; g += 1)
                                 if (self.elements[g][1].isRelated(hc))
                                    fail = true;
                           }
                           for (let h = peers.length - 1; !fail && h > k; h -= 1) {
                              let [hdx, hc] = peers[h];
                              (kdx < hdx).assert();
                              for (let g = kdx + 1; !fail && g < hdx; g += 1)
                                 if (self.elements[g][1].isRelated(hc))
                                    fail = true;
                           }
                           if (!fail) {
                              // we can converge on kdx.
                              let eS = self.elements.copy();
                              eS[kdx] = [a, b.parent];
                              // now delete from last.
                              for (let i = peers.length - 1; i >= 0; i -= 1) {
                                 if (i == k)
                                    continue;
                                 eS.splice(peers[i][0], 1);
                              }
                              self = new Root(...eS);
                              changed = true;
                           }
                        }
                        break;
                     }
                  } else if (b.parent.isUnder(d))
                     break;
               }
            }
            if (!changed)
               return self;
         }
      }


      compact(): Root { return this; }



      swap(i: number, j: number) {
         (i != j).assert();
         let [ei, ci] = this.elements[i];
         let [ej, cj] = this.elements[j];
         (ci == cj).assert();
         let eS = this.elements.copy();
         eS[i] = [ej, ci];
         eS[j] = [ei, cj];
         return new Root(...eS);
      }
      lowestChannel(idx: number, jdx: number): [pt.Channel, number] {
         (idx <= jdx).assert();
         let cn = this.elements[idx][1];
         if (idx == jdx)
            return [cn, 1];
         let last = this.elements[jdx][1];
         if (!cn.isRelated(last))
            return [null, -1];
         let use = cn.isUnder(last) ? cn : last;
         let len = 2;
         for (let kdx = idx + 1; kdx < jdx; kdx += 1) {
            let cn = this.elements[kdx][1];
            if (cn.isUnder(use)) {
               len += 1;
               use = cn;
            } else if (use.isUnder(cn))
               len += 1;
         }
         return [use, len];
      }
      /*
      exec(idx: number, cn: Channel, oldS: Seq, newS: Seq, txtSS: Unify[], unstaropt = false): Root {
         let eS = this.elements.copy();
         {
            let at = idx;
            let at0 = idx;
            while (true) {
               if (at == idx + oldS.children.length)
                  break;
               else if (at0 == eS.length)
                  return null;
               else if (cn.isUnder(eS[at0][1])) {
                  if (at != at0) {
                     let temp = eS[at0];
                     eS[at0] = eS[at];
                     eS[at] = temp;
                  }
                  at += 1;
                  at0 += 1;
               } else if (eS[at0][1].isUnder(cn))
                  return null;
               else at0 += 1;
            }
         }
         let self = new pt.Root(...eS);
         self = unstaropt ? self : self.split(cn, idx, oldS.children.length);
         let oldT = self.slice(idx, idx + oldS.children.length);
         (oldT.elements.length == oldS.children.length).assert();
         let txtS = txtSS;
         for (let i = 0; i < oldT.elements.length; i += 1) {
            if (txtS.length == 0)
               break;
            txtS = oldS.children[i].unifyAll(oldT.elements[i][0], txtS, pt.Root.make(...oldS.children));
            if (!unstaropt)
               (oldT.elements[i][1] == cn).assert();
            else if (oldT.elements[i][1] != cn.parent)
               return null;
         }
         if (txtS.length == 0)
            return null;
         oldS.replace(txtS[0]).equals(oldT.asSeq()).assert();

         //let flipped = txtS[0].flipOrTags();

         let newS0 = newS.replace(txtS[0]);
         if (!newS0)
            return null;
         let newT = new Root(...newS0.children.map(e => [e, cn] as [Pattern, Channel]));
         let retA = self.splice(idx, oldS.children.length, newT)
         retA = retA.merge();
         if (txtS.length > 0)
            txtSS[0] = txtS[0];
         return retA;
      }
      */
      setChannel(global: number, len: number, cn: Channel) {
         let eS = this.elements.copy();
         for (let i = 0; i < len; i += 1)
            eS[global + i] = [eS[global + i][0], cn];
         return new Root(...eS);
      }
      get liveNow(): Set<Channel> {
         let ret = new Set<Channel>();
         for (let [a, b] of this.elements) {
            for (let p = b; p; p = p.parent) {
               ret.add(p);
               for (let q of p.peers())
                  ret.add(q);
            }
         }
         return ret;
      }
      get endPoints(): Channel[] {
         let ret: Channel[] = [];
         for (let [a, cn] of this.elements) {
            let idx = ret.findIndex(bn => cn.isRelated(bn));
            if (idx < 0) {
               // not found.
               ret.push(cn);
            } else {
               let exist = ret[idx];
               if (exist.isUnder(cn))
                  continue;
               else ret[idx] = cn;
            }
         }
         // all peers.
         let peers: Channel[] = [];
         for (let e of ret)
            for (let p of e.peers()) {
               if (!ret.some(e => e.isUnder(p)))
                  peers.push(p);
            }
         return ret.concat(peers);
      }
      includeOnlyUnder(cn: Channel) {
         let ret: [Pattern, Channel][] = [];
         for (let [a, b] of this.elements) {
            if (cn.isUnder(b) && cn != b)
               continue;
            else if (!b.isUnder(cn))
               continue;
            ret.push([a, b]);
         }
         return new Root(...ret);
      }

      access(path: number[], limit?: number) {
         (path.length > 1 && path[0] == 0).assert();
         if (limit == 1)
            return this.asSeq();
         let e = this.elements[path[1]][0];
         (limit == null || limit >= 2).assert();
         if (path.length == 2)
            return e;
         else return e.accessP(path, 2, limit);
      }
      update(path: number[], p: Pattern) {
         (path[0] == 0).assert();
         if (path.length == 1) {
            if (p instanceof Seq)
               return pt.Root.make(...p.children);
            else return pt.Root.make(p);
         }
         let idx = path[1];
         let [e, cn] = this.elements[idx];
         let f = e.updateP(path, 2, p);
         if (f == null)
            return null;
         let eS = this.elements.copy();
         eS[idx] = [f, cn];
         return new pt.Root(...eS);
      }
      replace(txt: Unify): Root {
         let eS = this.elements.map(([a, b]) => [a.replace(txt), b] as [Pattern, Channel]);
         if (eS.some(([a, b]) => a == null))
            return null;
         else return new pt.Root(...eS);
      }




   }

   export const smallY = new pt.Term("y");
   export const bigX = new pt.Term("X", false);

   export const smallA = new pt.Term("a");
   export const smallB = new pt.Term("b");
   export const smallC = new pt.Term("c");
   export const smallD = new pt.Term("d");
   export const smallE = new pt.Term("e");
   export const smallF = new pt.Term("f");

}
namespace pt {
   /*
   export class Subscript extends Single {
      get plength() { return 1; }
      get end() {
         return "_" + (this.n < 0 ? "m" + (-this.n).toString() : this.n.toString());
      }
      get child() { return super.child as pt.Term; }
      get isAtomic() {
         return this.mode != "none";
      }
      constructor(child: pt.Term, readonly n: number, readonly mode: "lo" | "hi" | "atomic" | "none") {
         super(child);
      }
      recast(children: pt.Pattern[]): this {
         if (children.length != 1)
            return null;
         let [child] = children;
         if (child instanceof pt.Term)
            return new Subscript(children[0] as pt.Term, this.n, this.mode) as this;
         else if (child instanceof pt.Subscript && this.n == 0)
            return child as this;
         else return null;

      }
      label(root: Root): string {
         if (this.n == 0)
            return "";
         let subscripts = root.subscriptsFor(this.child);
         if (subscripts.length == 1)
            return "";
         let idx = subscripts.indexOf(this.n);
         let jdx = idx;
         (this.n != 0).assert();
         if (this.n < 0)
            while (jdx < subscripts.length && subscripts[jdx] < 0)
               jdx += 1;
         else while (jdx >= 0 && subscripts[jdx] > 0)
            jdx -= 1;
         return ((this.n < 0) ? "m" : "") + idx.dist(jdx).toString();
      }
      equals(other: BasePattern, strict: "yes" | "no" = "yes"): boolean {
         if (!super.equals(other, strict))
            return false;
         else if ((other as Subscript).n != this.n || (other as Subscript).mode != this.mode)
            return false;
         return true;
      }
      get execEqVal() { return this.child.execEqVal; }

      lift(dir : "front" | "back", root : Root) {
         let ascending: boolean;
         if (this.mode == "hi") {
            ascending = dir == "back";
         } else if (this.mode == "lo") {
            ascending = dir == "front";
         } else return null;
         let n = root.allocateSubscript(this.child, this.n, ascending == (dir == "back") ? "after" : "before");
         return new pt.Ordered(new pt.Subscript(this.child, n, "none"), ascending);
      }
   }
   export interface Root {
      subscripts: Map<Term, number[]>;
      subscriptsFor(term: Term): number[];
      allocateSubscript(term: Term, from: number, dir: "before" | "after"): number;
      pivot(idx: number): [Root, number[][]];
   }
   Root.prototype.subscriptsFor = function (term) {
      let self = this as Root;
      if (!self.subscripts)
         self.subscripts = new Map<Term, number[]>();
      return self.subscripts.getOrSet(term, (term) => {
         let found = new Set<number>();
         self.elements.forEach(e => e[0].visit((p) => {
            if (p == term) {
               found.add(0);
               return false;
            } else if (p instanceof Subscript && p.child == term) {
               found.add(p.n);
               return false;
            }
            return true;
         }));
         return found.toArray().sort((a, b) => a - b);
      })
   }
   Root.prototype.allocateSubscript = function (term, from, dir) {
      let self = this as Root;
      let subscripts = self.subscriptsFor(term);
      let idx = subscripts.indexOf(from);
      (idx >= 0).assert();
      if (idx == 0 && dir == "before")
         return from - 1024;
      else if (idx == subscripts.length - 1 && dir == "after")
         return from + 1024;
      else return from.lerp(subscripts[idx + (dir == "after" ? +1 : -1)], .5);
   }


   export const LoPivot = "low";
   export const HiPivot = "hi";
   Root.prototype.pivot = function (idx) {
      let self = this as Root;
      let [input, cn] = self.elements[idx];
      if (!(input instanceof Term) && !(input instanceof Subscript))
         return null;
      let n = input instanceof Term ? 0 : input.n;
      let term = input instanceof Term ? input : input.child;
      if (input instanceof Subscript && input.isAtomic)
         return null;
      let indicies: number[][] = [];
      for (let i = 0; i < self.elements.length; i += 1)
         if (i == idx || !self.elements[i][1].isRelated(cn)) {
            continue;
         } else {
            self.elements[i][0].identify(a => {
               if (a.equals(input))
                  return true;
               else if (a instanceof Term || a instanceof Subscript)
                  return "stop";
               else return false;
            }, [i], indicies);
         }
      let [lo, hi] = [self.allocateSubscript(term, n, "before"), self.allocateSubscript(term, n, "after")];
      let or = new Subscript(term, lo, "none").or([LoPivot, HiPivot], new Subscript(term, hi, "none"));
      let seq = self.asSeq();
      for (let path of indicies) {
         let a = self.access(path);
         a.equals(input).assert();
         let path0 = path.copy();
         path0.unshift(0);
         seq = seq.update(path0, or);
      }
      let eS = self.elements.copy();
      eS[idx] = [new Subscript(term, n, "atomic"), cn];
      for (let i = 0; i < eS.length; i += 1)
         if (i != idx)
            eS[i] = [seq.children[i], eS[i][1]];
      return [new pt.Root(...eS), indicies];
   }

   export class Ordered extends Single implements StarLike {
      get isStarLike(): true { return true; }
      isSame(other: BasePattern): other is this { return other instanceof Ordered };
      get child(): Subscript { return super.child as (Subscript); }
      constructor(child: Subscript, readonly ascending: boolean) {
         super(child);
         (!child.isAtomic).assert();
      }
      get end() {
         return "*" + (this.ascending ? "/" : "\\");
      }
      get execEqVal() { return new Star(this.child.child.execEqVal); }
      replace0(f: (p: Pattern) => Pattern): Pattern {
         let q = f(this);
         if (q)
            return q;
         let child = this.child.replace0(f);
         let child0: Subscript;
         if (child instanceof Subscript)
            child0 = child;
         else if (child instanceof Term)
            child0 = new Subscript(child, 0, "none");
         else return null;
         return new Ordered(child0, this.ascending);
      }
      recast(children: BasePattern[]): this {
         if (children.length != 1)
            return null;
         let [child] = children;
         let child0: Subscript;
         if (child instanceof Subscript)
            child0 = child;
         else if (child instanceof Term)
            child0 = new Subscript(child, 0, "none");
         else return null;
         return new Ordered(child0, this.ascending) as this;
      }
      get plength(): "unknown" { return "unknown"; }
      equals(other: BasePattern, strict: "yes" | "no" = "yes"): boolean {
         if (!super.equals(other, strict))
            return false;
         else if ((other as Ordered).ascending != this.ascending)
            return false;
         return true;
      }
      get term() { return this.child.child; }
      pop(dir: "left" | "right", root: Root): [[Subscript, Ordered]] | [[Ordered, Subscript]] {
         let mode: "before" | "after" = (this.ascending == (dir == "left")) ? "before" : "after";
         let n = root.allocateSubscript(this.term, this.child.n, mode);
         let cA = new Subscript(this.term, n, mode == "before" ? "lo" : "hi");
         return dir == "left" ? [[cA, this]] : [[this, cA]];

      }
      push(dir: "left" | "right", what: Pattern, filtered : Root): this {
         if (what instanceof Ordered || what instanceof Subscript) {}
         else return null;
         let inner: Subscript;
         if (what instanceof Subscript) {
            if (!what.isAtomic)
               return null;
            inner = what;
         } else {
            if (what.ascending != this.ascending)
               return null;
            inner = what.child;
         }
         let subscripts = filtered.subscriptsFor(inner.child);
         let [idx, jdx] = [subscripts.indexOf(this.child.n), subscripts.indexOf(inner.n)];
         (jdx >= 0).assert();
         if (dir == "left" == this.ascending)
            return (idx + 1 == jdx) ? this : null;
         else return (idx - 1 == jdx) ? this : null;
      }
      lift(dir : "front" | "back", root : Root) : Ordered {
         return null;
      }

   }
   */
}

namespace pt {
   const subscripts = [
      "₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"
   ]
   export function convertToSub(n: number): string {
      let m = n % 10;
      let sb = subscripts[m];
      if ((n - m) == 0)
         return sb;
      return convertToSub((n - m) / 10) + sb;
   }
   export function convertToNumber(s: string): number {
      if (s.length == 0)
         return 0;
      let value = s.last().charCodeAt(0) - subscripts[0].charCodeAt(0);
      return value + convertToNumber(s.slice(0, s.length - 1)) * 10;
   }

}