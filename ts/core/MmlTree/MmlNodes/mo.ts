/*************************************************************
 *
 *  Copyright (c) 2017 The MathJax Consortium
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

/**
 * @fileoverview  Implements the MmlMo node
 *
 * @author dpvc@mathjax.org (Davide Cervone)
 */

import {PropertyList} from '../../Tree/Node.js';
import {AbstractMmlTokenNode, MmlNode, AttributeList, TEXCLASS} from '../MmlNode.js';
import {MmlMrow} from './mrow.js';
import {MmlMover, MmlMunder, MmlMunderover} from './munderover.js';
import {OperatorList, OPTABLE, RangeDef, RANGES, MMLSPACING} from '../OperatorDictionary.js';

/*****************************************************************/
/**
 *  Implements the MmlMo node class (subclass of AbstractMmlTokenNode)
 */

export class MmlMo extends AbstractMmlTokenNode {

  /**
   * @override
   */
  public static defaults: PropertyList = {
    ...AbstractMmlTokenNode.defaults,
    form: 'infix',
    fence: false,
    separator: false,
    lspace: 'thickmathspace',
    rspace: 'thickmathspace',
    stretchy: false,
    symmetric: false,
    maxsize: 'infinity',
    minsize: '0em', // MathML says '1em', but that is larger than some natural sizes
    largeop: false,
    movablelimits: false,
    accent: false,
    linebreak: 'auto',
    lineleading: '1ex',
    linebreakstyle: 'before',
    indentalign: 'auto',
    indentshift: '0',
    indenttarget: '',
    indentalignfirst: 'indentalign',
    indentshiftfirst: 'indentshift',
    indentalignlast: 'indentalign',
    indentshiftlast: 'indentshift'
  };

  /**
   * Unicode ranges and their default TeX classes
   */
  public static RANGES = RANGES;

  /**
   * The MathML spacing values for the TeX classes
   */
  public static MMLSPACING = MMLSPACING;

  /**
   * The Operator Dictionary
   */
  public static OPTABLE: {[form: string]: OperatorList} = OPTABLE;

  /**
   * The internal TeX class of the node (for use with getter/setter below)
   */
  public _texClass: number = null;

  /**
   * Use a getter to look up the TeX class from the operator table if it hasn't
   * been set yet (but don't save it in case the form changes when it is in its
   * location).
   */
  public get texClass() {
    if (this._texClass === null) {
      let mo = this.getText();
      let [form1, form2, form3] = this.handleExplicitForm(this.getForms());
      let OPTABLE = (this.constructor as typeof MmlMo).OPTABLE;
      let def = OPTABLE[form1][mo] || OPTABLE[form2][mo] || OPTABLE[form3][mo];
      return def ? def[2] : TEXCLASS.REL;
    }
    return this._texClass;
  }

  /**
   * Use a setter to store the actual value in _texClass;
   */
  public set texClass(value: number) {
    this._texClass = value;
  }

  /**
   * The default MathML spacing on the left
   */
  /* tslint:disable-next-line:whitespace */
  public lspace = 5/18;

  /**
   * The default MathML spacing on the right
   */
  /* tslint:disable-next-line:whitespace */
  public rspace = 5/18;

  /**
   * @override
   */
  public get kind() {
    return 'mo';
  }

  /**
   * All <mo> are considered embellished
   * @override
   */
  public get isEmbellished() {
    return true;
  }

  /**
   * @return {boolean}  Is <mo> marked as an explicit linebreak?
   */
  public get hasNewLine(): boolean {
    return this.attributes.get('linebreak') === 'newline';
  }

  /**
   * @return {MmlNode}  The node that is the outermost embellished operator
   *                    with this node as its core
   */
  public coreParent(): MmlNode {
    let embellished = this as MmlNode;
    let parent = this as MmlNode;
    let math = this.factory.getNodeClass('math');
    while (parent && parent.isEmbellished && parent.coreMO() === this && !(parent instanceof math)) {
      embellished = parent;
      parent = (parent as MmlNode).Parent;
    }
    return embellished;
  }

  /**
   * @param {MmlNode} parent  The node whose core text is to be obtained
   * @return {string}         The text of the core MO of the given parent element
   */
  public coreText(parent: MmlNode): string {
    if (!parent) {
      return '';
    }
    if (parent.isEmbellished) {
      return (parent.coreMO() as MmlMo).getText();
    }
    while ((((parent.isKind('mrow') || parent.isKind('TeXAtom') || parent.isKind('mstyle') ||
              parent.isKind('mphantom')) && parent.childNodes.length === 1) ||
            parent.isKind('munderover')) && parent.childNodes[0]) {
      parent = parent.childNodes[0] as MmlNode;
    }
    return (parent.isToken ? (parent as AbstractMmlTokenNode).getText() : '');
  }

  /**
   * @override
   */
  public hasSpacingAttributes() {
    return this.attributes.isSet('lspace') ||
      this.attributes.isSet('rspace');
  }

  /**
   * @return {boolean}  True is this mo is an accent in an munderover construction
   */
  get isAccent(): boolean {
    let accent = false;
    const node = this.coreParent().parent;
    if (node) {
      const key = (node.isKind('mover') ?
                   ((node.childNodes[(node as MmlMover).over] as MmlNode).coreMO() ?
                    'accent' : '') :
                   node.isKind('munder') ?
                   ((node.childNodes[(node as MmlMunder).under] as MmlNode).coreMO() ?
                    'accentunder' : '') :
                   node.isKind('munderover') ?
                   (this === (node.childNodes[(node as MmlMunderover).over] as MmlNode).coreMO() ?
                    'accent' :
                    this === (node.childNodes[(node as MmlMunderover).under] as MmlNode).coreMO() ?
                    'accentunder' : '') :
                   '');
      if (key) {
        const value = node.attributes.getExplicit(key);
        accent = (value !== undefined ? accent : this.attributes.get('accent')) as boolean;
      }
    }
    return accent;
  }

  /**
   * Produce the texClass based on the operator dictionary values
   *
   * @override
   */
  public setTeXclass(prev: MmlNode): MmlNode {
    let {form, fence} = this.attributes.getList('form', 'fence') as {form: string, fence: string};
    if (this.getProperty('texClass') === undefined &&
        (this.attributes.isSet('lspace') || this.attributes.isSet('rspace'))) {
      return null;
    }
    if (fence && this.texClass === TEXCLASS.REL) {
      if (form === 'prefix') {
        this.texClass = TEXCLASS.OPEN;
      }
      if (form === 'postfix') {
        this.texClass = TEXCLASS.CLOSE;
      }
    }
    if (this.getText() === '\u2061') {
      //
      //  Force previous node to be TEXCLASS.OP and skip this node
      //
      if (prev && prev.getProperty('texClass') === undefined &&
          prev.attributes.get('mathvariant') !== 'italic') {
        prev.texClass = TEXCLASS.OP;
        prev.setProperty('fnOP', true);
      }
      this.texClass = this.prevClass = TEXCLASS.NONE;
      return prev;
    }
    return this.adjustTeXclass(prev);
  }
  /**
   * Follow the TeXBook rules for adjusting the TeX class once its neighbors are known
   *
   * @param {MmlNode} prev  The node appearing before this one in the output
   * @return {MmlNode}      The last node displayed (this node)
   */
  public adjustTeXclass(prev: MmlNode): MmlNode {
    let texClass = this.texClass;
    let prevClass = this.prevClass;
    if (texClass === TEXCLASS.NONE) {
      return prev;
    }
    if (prev) {
      if (prev.getProperty('autoOP') && (texClass === TEXCLASS.BIN || texClass === TEXCLASS.REL)) {
        prevClass = prev.texClass = TEXCLASS.ORD;
      }
      prevClass = this.prevClass = (prev.texClass || TEXCLASS.ORD);
      this.prevLevel = this.attributes.getInherited('scriptlevel') as number;
    } else {
      prevClass = this.prevClass = TEXCLASS.NONE;
    }
    if (texClass === TEXCLASS.BIN &&
        (prevClass === TEXCLASS.NONE || prevClass === TEXCLASS.BIN || prevClass === TEXCLASS.OP ||
         prevClass === TEXCLASS.REL || prevClass === TEXCLASS.OPEN || prevClass === TEXCLASS.PUNCT)) {
      this.texClass = TEXCLASS.ORD;
    } else if (prevClass === TEXCLASS.BIN &&
               (texClass === TEXCLASS.REL || texClass === TEXCLASS.CLOSE || texClass === TEXCLASS.PUNCT)) {
      prev.texClass = this.prevClass = TEXCLASS.ORD;
    } else if (texClass === TEXCLASS.BIN) {
      //
      // Check if node is the last one in its container since the rule
      // above only takes effect if there is a node that follows.
      //
      let child: MmlNode = this;
      let parent = this.parent;
      while (parent && parent.parent && parent.isEmbellished &&
             (parent.childNodes.length === 1 ||
              (!parent.isKind('mrow') && parent.core() === child))) {
        child = parent;
        parent = parent.parent;
      }
      if (parent.childNodes[parent.childNodes.length - 1] === child) {
        this.texClass = TEXCLASS.ORD;
      }
    }
    return this;
  }

  /**
   * Do the normal inheritance, then look up the attributes from the operator dictionary.
   * If there is no dictionary entry, get the TeX class from the Unicode range list.
   *
   * @override
   */
  public setInheritedAttributes(attributes: AttributeList = {},
                                display: boolean = false, level: number = 0, prime: boolean = false) {
    super.setInheritedAttributes(attributes, display, level, prime);
    let mo = this.getText();
    let [form1, form2, form3] = this.handleExplicitForm(this.getForms());
    this.attributes.setInherited('form', form1);
    let OPTABLE = (this.constructor as typeof MmlMo).OPTABLE;
    let def = OPTABLE[form1][mo] || OPTABLE[form2][mo] || OPTABLE[form3][mo];
    if (def) {
      if (this.getProperty('texClass') === undefined) {
        this.texClass = def[2];
      }
      for (const name of Object.keys(def[3] || {})) {
        this.attributes.setInherited(name, def[3][name]);
      }
      this.lspace = (def[0] + 1) / 18;
      this.rspace = (def[1] + 1) / 18;
    } else {
      let range = this.getRange(mo);
      if (range) {
        if (this.getProperty('texClass') === undefined) {
          this.texClass = range[2];
        }
        const spacing = (this.constructor as typeof MmlMo).MMLSPACING[range[2]];
        this.lspace = (spacing[0] + 1) / 18;
        this.rspace = (spacing[1] + 1) / 18;
      }
    }
  }

  /**
   * @return {[string, string, string]}  The list of form attribute values in the
   *                                     order they should be tested, based on the
   *                                     position of the element in its parent.
   */
  public getForms(): [string, string, string] {
    let core: MmlNode = this;
    let parent = this.parent;
    let Parent = this.Parent;
    while (Parent && Parent.isEmbellished) {
      core = parent;
      parent = Parent.parent;
      Parent = Parent.Parent;
    }
    if (parent && parent.isKind('mrow') && (parent as MmlMrow).nonSpaceLength() !== 1) {
      if ((parent as MmlMrow).firstNonSpace() === core) {
        return ['prefix', 'infix', 'postfix'];
      }
      if ((parent as MmlMrow).lastNonSpace() === core) {
        return ['postfix', 'infix', 'prefix'];
      }
    }
    return ['infix', 'prefix', 'postfix'];
  }

  /**
   * @param {string[]} forms     The three forms in the default order they are to be tested
   * @return {string[]}          The forms in the new order, if there is an explicit form attribute
   */
  protected handleExplicitForm(forms: string[]): string[] {
    if (this.attributes.isSet('form')) {
      const form = this.attributes.get('form') as string;
      forms = [form].concat(forms.filter(name => (name !== form)));
    }
    return forms;
  }

  /**
   * @param {string} mo  The character to look up in the range table
   * @return {RangeDef}  The unicode range in which the character falls, or null
   */
  protected getRange(mo: string): RangeDef {
    if (!mo.match(/^[\uD800-\uDBFF]?.$/)) {
      return null;
    }
    let n = mo.codePointAt(0);
    let ranges = (this.constructor as typeof MmlMo).RANGES;
    for (const range of ranges) {
      if (range[0] <= n && n <= range[1]) {
        return range;
      }
      if (n < range[0]) {
        return null;
      }
    }
    return null;
  }

}
