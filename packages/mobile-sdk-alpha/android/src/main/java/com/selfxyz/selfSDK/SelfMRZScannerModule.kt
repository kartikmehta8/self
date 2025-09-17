// SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
// SPDX-License-Identifier: BUSL-1.1
// NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.

package com.selfxyz.selfSDK

import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import android.view.ViewGroup
import android.view.View
import android.widget.FrameLayout
import com.selfxyz.selfSDK.ui.CameraMLKitFragment
import org.jmrtd.lds.icao.MRZInfo

class SelfMRZScannerModule(reactContext: ReactApplicationContext) :
ReactContextBaseJavaModule(reactContext), CameraMLKitFragment.CameraMLKitCallback {
    override fun getName() = "SelfMRZScannerModule"

    private var scanPromise: Promise? = null
    private var currentContainer: FrameLayout? = null
    private var currentFragment: CameraMLKitFragment? = null

    @ReactMethod
    fun startScanning(promise: Promise) {
        val activity = reactApplicationContext.currentActivity as? FragmentActivity
        if (currentFragment != null || currentContainer != null || scanPromise != null) {
            promise.reject("E_SCAN_IN_PROGRESS", "Scanning already in progress")
            return
        }
        if (activity == null) {
            promise.reject("E_NO_ACTIVITY", "No FragmentActivity found")
            return
        }
        scanPromise = promise


        activity.runOnUiThread {
            try {
                val container = FrameLayout(activity)
                // just using view.generateViewId() doesn't work.
                val containerId = generateUnusedId(activity.window.decorView as ViewGroup)
                container.id = containerId

                container.layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )

                container.isFocusable = true
                container.isFocusableInTouchMode = true
                container.setBackgroundColor(android.graphics.Color.BLACK)

                activity.addContentView(container, ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                ))

                val fragment = CameraMLKitFragment(this@SelfMRZScannerModule)

                // Store references for cleanup
                currentContainer = container
                currentFragment = fragment

                activity.supportFragmentManager
                    .beginTransaction()
                    .replace(containerId, fragment)
                    .commitNow()

            } catch (e: Exception) {
                android.util.Log.e("SelfMRZScannerModule", "Error in startScanning", e)
                promise.reject("E_SCANNING_ERROR", e.message, e)
                cleanup()
            }
        }
    }

    override fun onPassportRead(mrzInfo: MRZInfo) {
        scanPromise?.resolve(mrzInfo.toString())
        scanPromise = null
        cleanup()
    }

    override fun onError(e: Exception) {
        scanPromise?.reject(e)
        scanPromise = null
        cleanup()
    }

    private fun generateUnusedId(root: ViewGroup): Int {
        var id: Int
        do { id = View.generateViewId() } while (root.findViewById<View>(id) != null)
        return id
    }

    private fun cleanup() {
        val activity = reactApplicationContext.currentActivity as? FragmentActivity
        val fragment = currentFragment
        val container = currentContainer
        currentFragment = null
        currentContainer = null
        scanPromise = null

        if (activity != null && fragment != null && container != null) {
            activity.runOnUiThread {
                try {
                    activity.supportFragmentManager
                        .beginTransaction()
                        .remove(fragment)
                        .commitAllowingStateLoss()

                    (container.parent as? ViewGroup)?.removeView(container)

                    android.util.Log.d("SelfMRZScannerModule", "Cleaned up fragment and container")
                } catch (e: Exception) {
                    android.util.Log.e("SelfMRZScannerModule", "Error during cleanup", e)
                }
            }
        }
    }
}
