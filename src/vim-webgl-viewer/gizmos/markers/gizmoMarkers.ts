import { Viewer } from '../../viewer';
import * as THREE from 'three';
import { GizmoMarker } from './gizmoMarker';

/**
 * API for adding and managing sprite markers in the scene.
 */
export class GizmoMarkers {
  private _viewer: Viewer;
  private _markers: GizmoMarker[] = [];

  constructor (viewer: Viewer){
    this._viewer = viewer
  }

  /**
   * Adds a sprite marker at the specified position.
   * @param {THREE.Vector3} position - The position at which to add the marker.
   */  
  add(position: THREE.Vector3) {

    var marker = new GizmoMarker(this._viewer);
    marker.position.copy(position);
    marker.load();
    this._markers.push(marker);
  }

  /**
   * Removes the specified marker from the scene.
   * @param {GizmoMarker} marker - The marker to remove.
   */
  remove(marker: GizmoMarker) {

    marker.unload();
    var index = this._markers.findIndex(m => m === marker);
    this._markers[index] = this._markers[this._markers.length - 1];
    this._markers.length -= 1;
  }

  /**
   * Removes all markers from the scene.
   */
  clear() {
    this._markers.forEach(m => m.unload());
    this._markers.length = 0;
  }
}
