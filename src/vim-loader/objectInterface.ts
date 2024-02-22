import * as THREE from 'three';
import { Vim } from './vim';
import { VimDocument, IElement, VimHelpers } from 'vim-format';

export type ObjectType = "Architectural" | "Marker"

/**
 * API to interact with an object that is both visible and related to a bim element.
 */
export interface IObject {
  type: ObjectType;
  vim: Vim;
  document: VimDocument;
  element: number;
  elementId: BigInt;
  instances: number[] | undefined;

  /**
   * Returns true if this object has geometry
   */
  hasMesh: boolean;

  /**
   * Toggles selection outline for this object.
   * @param value true to show object, false to hide object.
   */
  outline: boolean;

  /**
   * Toggles focused highlight for this object.
   * @param value true to highlight object.
   */
  focused: boolean;

  /**
   * Toggles visibility of this object.
   * @param value true to show object, false to hide object.
   */
  visible: boolean;

  /**
   * Changes the display color of this object.
   * @param color Color to apply, undefined to revert to default color.
   */
  color: THREE.Color;

  /**
   * Returns Bim data for the element associated with this object.
   * Returns undefined if no associated bim
   */
  getBimElement(): Promise<IElement>;

  /**
   * Returns Bim data for the element associated with this object.
   */
  getBimParameters(): Promise<VimHelpers.ElementParameter[]>;

  /**
   * returns the bounding box of the object from cache or computed if needed.
   * Returns undefined if object has no geometry.
   */
  getBoundingBox(target?: THREE.Box3): THREE.Box3;

  /**
   * Returns the center position of this object
   * @param target Vector3 where to copy data. A new instance is created if none provided.
   * Returns undefined if object has no geometry.
   */
  getCenter(target: THREE.Vector3): THREE.Vector3;
}
