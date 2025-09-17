// SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
// SPDX-License-Identifier: BUSL-1.1
// NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.


package com.selfxyz.selfSDK

import android.view.Choreographer
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.annotations.ReactPropGroup
import com.facebook.react.uimanager.events.RCTEventEmitter
import org.jmrtd.lds.icao.MRZInfo
import com.selfxyz.selfSDK.ui.CameraMLKitFragment

class SelfOCRViewManager(
    open val reactContext: ReactApplicationContext
   ) : ViewGroupManager<FrameLayout>(), CameraMLKitFragment.CameraMLKitCallback {
    private var propWidth: Int? = null
    private var propHeight: Int? = null
    private var reactNativeViewId: Int? = null

    override fun getName() = REACT_CLASS

    override fun createViewInstance(reactContext: ThemedReactContext): FrameLayout {
        return FrameLayout(reactContext)
    }

    override fun getCommandsMap() = mapOf(
        "create" to COMMAND_CREATE,
        "destroy" to COMMAND_DESTROY
    )

    override fun receiveCommand(
        root: FrameLayout,
        commandId: String,
        args: ReadableArray?
    ) {
        super.receiveCommand(root, commandId, args)

        val reactNativeViewId = args?.getInt(0)
        if (reactNativeViewId == null) {
            android.util.Log.w("SelfOCRViewManager", "receiveCommand called with null or empty args for command: $commandId")
            return
        }

        when (commandId) {
            "create" -> {
                createFragment(root, reactNativeViewId)
            }
            "destroy" -> {
                destroyFragment(root, reactNativeViewId)
            }
            else -> {
                android.util.Log.w("SelfOCRViewManager", "Unknown command: $commandId")
            }
        }
    }

    // Alternative method signature for newer React Native versions
    override fun receiveCommand(
        root: FrameLayout,
        commandId: Int,
        args: ReadableArray?
    ) {
        super.receiveCommand(root, commandId, args)

        val reactNativeViewId = args?.getInt(0)
        if (reactNativeViewId == null) {
            android.util.Log.w("SelfOCRViewManager", "receiveCommand called with null or empty args for command: $commandId")
            return
        }

        when (commandId) {
            COMMAND_CREATE -> {
                createFragment(root, reactNativeViewId)
            }
            COMMAND_DESTROY -> {
                destroyFragment(root, reactNativeViewId)
            }
            else -> {
                android.util.Log.w("SelfOCRViewManager", "Unknown command: $commandId")
            }
        }
    }

    @ReactPropGroup(names = ["width", "height"], customType = "Style")
    fun setStyle(view: FrameLayout, index: Int, value: Int) {
        if (index == 0) propWidth = value
        if (index == 1) propHeight = value
    }

    // @ReactProp(name = "width")
    // fun setWidth(view: FrameLayout, width: Int) {
    //     propWidth = width
    // }

    // @ReactProp(name = "height")
    // fun setHeight(view: FrameLayout, height: Int) {
    //     propHeight = height
    // }

    private fun createFragment(root: FrameLayout, reactNativeViewId: Int) {
        this.reactNativeViewId = reactNativeViewId
        val parentView = root.findViewById<ViewGroup>(reactNativeViewId)
        if (parentView == null) {
            android.util.Log.e("SelfOCRViewManager", "Parent view not found for ID: $reactNativeViewId")
            return
        }
        setupLayout(parentView)

        val activity = reactContext.currentActivity as? FragmentActivity
        if (activity == null) {
            android.util.Log.e("SelfOCRViewManager", "No FragmentActivity found")
            return
        }

        // Check if activity is in a valid state
        if (activity.isFinishing || activity.isDestroyed) {
            android.util.Log.e("SelfOCRViewManager", "Activity is finishing or destroyed")
            return
        }

        val cameraFragment = CameraMLKitFragment(this)
        android.util.Log.d("SelfOCRViewManager", "Starting fragment transaction")

        // Post to ensure activity is fully ready
        activity.window.decorView.post {
            try {
                if (!activity.isFinishing && !activity.isDestroyed) {
                    activity.supportFragmentManager
                        .beginTransaction()
                        .replace(reactNativeViewId, cameraFragment, reactNativeViewId.toString())
                        .commitNow()
                } else {
                    android.util.Log.e("SelfOCRViewManager", "Activity no longer valid for fragment transaction")
                }
            } catch (e: Exception) {
                android.util.Log.e("SelfOCRViewManager", "Fragment transaction failed", e)
            }
        }
    }

    private fun destroyFragment(root: FrameLayout, reactNativeViewId: Int) {
        val parentView = root.findViewById<ViewGroup>(reactNativeViewId)
        setupLayout(parentView)

        val activity = reactContext.currentActivity as FragmentActivity
        val cameraFragment = activity.supportFragmentManager.findFragmentByTag(reactNativeViewId.toString())
        cameraFragment?.let {
            activity.supportFragmentManager
                .beginTransaction()
                .remove(it)
                .commit()
        }
    }

    private fun setupLayout(view: View) {
        Choreographer.getInstance().postFrameCallback(object: Choreographer.FrameCallback {
            override fun doFrame(frameTimeNanos: Long) {
                manuallyLayoutChildren(view)
                view.viewTreeObserver.dispatchOnGlobalLayout()
                Choreographer.getInstance().postFrameCallback(this)
            }
        })
    }

    private fun manuallyLayoutChildren(view: View) {
        // propWidth and propHeight coming from react-native props
        val width = propWidth ?: 800 // Default fallback
        val height = propHeight ?: 800 // Default fallback

        view.measure(
            View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY))

        view.layout(0, 0, width, height)
    }

    override fun onPassportRead(mrzInfo: MRZInfo) {
        val event = Arguments.createMap()
        event.putString("data", mrzInfo.toString())
        reactContext
            .getJSModule(RCTEventEmitter::class.java)
            .receiveEvent(this.reactNativeViewId!!, SUCCESS_EVENT, event)
    }

    override fun onError(e: Exception) {
        val event = Arguments.createMap()
        event.putString("errorMessage", "Something went wrong scanning MRZ with camera")
        event.putString("error", e.toString())
        event.putString("stackTrace", e.stackTraceToString())
        reactContext
            .getJSModule(RCTEventEmitter::class.java)
            .receiveEvent(this.reactNativeViewId!!, FAILURE_EVENT, event)
    }

    override fun getExportedCustomBubblingEventTypeConstants(): Map<String, Any> {
        return mapOf(
            SUCCESS_EVENT to mapOf(
                "phasedRegistrationNames" to mapOf(
                    "bubbled" to "onPassportRead"
                )
            ),
            FAILURE_EVENT to mapOf(
                "phasedRegistrationNames" to mapOf(
                    "bubbled" to "onError"
                )
            )
        )
    }

    companion object {
      private const val REACT_CLASS = "SelfOCRViewManager"
      private const val COMMAND_CREATE = 1
      private const val COMMAND_DESTROY = 2
      private const val SUCCESS_EVENT = "onPassportReadResult"
      private const val FAILURE_EVENT = "onPassportReadError"
    }

}
