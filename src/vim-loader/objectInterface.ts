/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { Vim } from './vim'
import { IElement, VimHelpers } from 'vim-format'

export type ObjectType = 'Architectural' | 'Marker'

/**
 * API to interact with an object that is both visible and related to a bim element.
 */
export interface IObject {
  /**
   * Indicate whether this object is architectural or markup.
   */
  type: ObjectType;

  /**
   * The vim object from which this object came from.
   */
  vim: Vim | undefined;

  /**
   * The bim element index associated with this object.
   */
  element: number | undefined;

  /**
   * The ID of the element associated with this object.
   */
  elementId: BigInt | undefined;

  /**
   * The geometry instances  associated with this object.
   */
  instances: number[] | undefined;

  /**
   * Checks if this object has associated geometry.
   * @returns {boolean} True if this object has geometry, otherwise false.
   */
  hasMesh: boolean;

  /**
   * Determines whether to render selection outline for this object or not.
   */
  outline: boolean;

 /**
   * Determines whether to render focus highlight for this object or not.
   */
  focused: boolean;

   /**
   * Determines whether to render this object or not.
   */
  visible: boolean;

  /**
   * Gets or sets the display color of this object.
   * @param {THREE.Color | undefined} color The color to apply. Pass undefined to revert to the default color.
   * @returns {THREE.Color} The current color of the object.
   */
  color: THREE.Color;

  /**
   * Asynchronously retrieves Bim data for the element associated with this object.
   * @returns {IElement} An object containing the bim data for this element.
   */
  getBimElement(): Promise<IElement>;

  /**
   * Asynchronously retrieves Bim parameters for the element associated with this object.
   * @returns {VimHelpers.ElementParameter[]} An array of all bim parameters for this elements.
   */
  getBimParameters(): Promise<VimHelpers.ElementParameter[]>;

  /**
   * Retrieves the bounding box of the object from cache or computes it if needed.
   * Returns undefined if the object has no geometry.
   * @returns {THREE.Box3 | undefined} The bounding box of the object, or undefined if the object has no geometry.
   */
  getBoundingBox(target?: THREE.Box3): THREE.Box3;

  /**
   * Retrieves the center position of this object.
   * @param {THREE.Vector3} [target=new THREE.Vector3()] Optional parameter specifying where to copy the center position data.
   * A new instance is created if none is provided.
   * @returns {THREE.Vector3 | undefined} The center position of the object, or undefined if the object has no geometry.
   */
  getCenter(target: THREE.Vector3): THREE.Vector3;
}
