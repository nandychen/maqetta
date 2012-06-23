(function() {
	/**
	 * API for SceneManager plugins to Maqetta plug
	 * 
	 * A SceneManager is a JavaScript class that can be instanced by a "new" command.
	 *
	 * This class must provide the following methods:
	 * 
	 * constructor(context)
	 *		Class constructor. Must set this.name to a localized string.
 	 *		This 'name' string appears in the Scenes palette.
	 *		@param {davinci.ve.Context} context  Maqetta context object corresponding to davinci.ve.VisualEditor
	 * 
//FIXME: Inconsistent APIs: sometimes we pass node, other times ID
	 * selectScene(params)
	 *		A particular scene has been selected in the Scenes palette.
	 *		NOTE: Called from both page editor (widget helpers available) and review editor (widget helpers not available).
	 *		@param {object} params  Has following properties
	 *			params.sceneContainerNode - Node which contains the node with the given sceneId
	 *			params.sceneId - Unique ID for the selected scene. (Unique ID created by this SceneManager)
	 *		@returns {boolean}	Return true is a scene was selected
	 * 
	 * getCurrentScene(sceneContainerNode)
	 * 		@param {Element} sceneContainerNode  Scene container node into which we are looking for current scene
	 *		If there is a currently active scene, return its sceneId, else return null.
	 *		@returns {string} Unique ID for the selected active scene. (Unique ID created by this SceneManager)
	 * 
	 * getAllSceneContainers()
	 *		Returns all Elements in document that are direct parents of any scene nodes.
	 *		@returns {[Element]} Returns an array of elements
	 * 
	 * isSceneContainer(node)
	 *		Returns true if the given node is a scene container (i.e., it has children that represent a scene)
	 *		@param {Element} node  A DOM node in document
	 *		@returns {boolean} 
	 * 
	 * getSceneChildren(node)
	 *      Returns an array that lists the node's child nodes that represent "scenes"
	 *		@param {Element} node  A DOM node in document. (Presumably, a scene container node)
	 *		@returns {array} 	Returns an array of Elements, empty array if no scene children.
	 * 
	 * getSceneContainerForNode(node)
	 *      Returns the scene container parent node for the given node.
	 *		@param {Element} node  A DOM node in document. (Presumably, a scene node)
	 *		@returns {Element|node} 	Returns the scene container Element, or null if there is no scene container parent.
	 *
//FIXME: REMOVE THIS
	 * getAllScenes()
	 *		Returns a potentially nested array of all current scenes managed by this SceneManager.
	 *		@returns {[object]} retArray  Array of top-level scenes, where each scene is described
	 *					by an object with these properties
	 *			sceneId {string} - a document-unique ID for this scene
	 *			name {string} - the string for this scene that will appear in Scenes palette
	 *			type {string} - must be set to the "category" property for this SceneManager (see properties below)
	 *			parentSceneId {string}- if this scene is not top-level, then this must be the sceneId of its parent scene
	 *			children {[object]} - array of children scenes
	 * 
//FIXME: Remove this
	 * hideAppStates()
	 *		Returns true if the app should not show "application states". 
	 *		Usually, library returns true only if it offers an alternate notion of scenes.
	 *		NOTE: Called from both page editor (widget helpers available) and review editor (widget helpers not available).
	 *		@returns {boolean} 
	 *
//FIXME
	 * This class must provide the following properties on the SceneManager instance object:
	 * 
	 * id {string} - A unique ID for this SceneManager. Used as the index into Maqetta's list of SceneManagers
	 * name {string} - Localized string that is name of this SceneManager. This string appears in Scenes palette.
	 * category {string} - A string unique to this SceneManager that must be used as the 'type' property on each scene
	 * 
	 */
	function DojoMobileViewSceneManager(context) {
		this.context = context;
		//FIXME: How to do nls? Maybe need to convert callback.js to AMD and leverage AMD's I18N?
		this.name = 'Dojo Mobile Views'; //FIXME: Needs to be localized
	}
	
	DojoMobileViewSceneManager.prototype = {
		id: 'DojoMobileViews',
		category: 'DojoMobileView',
		
		_viewAdded: function(parent, child){
			dojo.publish("/davinci/scene/added", [this, parent, child]);
		},
		
		// View has been deleted from the given parent
		_viewDeleted: function(parent){
			dojo.publish("/davinci/scene/removed", [this, parent]);
		},
		_viewSelectionChanged: function(parent, child){
			if(child && child.id){
				dojo.publish("/davinci/scene/selectionChanged", [this, child.id]);
			}
		},
		_reviewEditorSceneChange: function(docContext){
			if(docContext == this.context && docContext.declaredClass == 'davinci.review.editor.Context'){
				var dj = docContext.getDojo();
				var _dijit = dj ? dj.dijit : null;
				if(_dijit){
					var views = dj.query('.mblView');
					for(var i=0; i<views.length; i++){
						var view = views[i];
						if(view.id){
							var viewDijit = _dijit.byId(view.id);
							if(viewDijit){
								// Listen for View and ScrollableView change (probably from touch gesture)
								viewDijit.onAfterTransitionIn = function(sm, viewId, moveTo, dir, transition, context, method){
									dojo.publish("/davinci/scene/selectionChanged", [sm, viewId]);
								}.bind(this, this, view.id);
								// Listen for SwapView changes (probably from flick gesture)
								dj.subscribe('/dojox/mobile/viewChanged', function(newView){
									// If this routine in in middle of forcing the view change, don't try to update anything
									if(this._swapViewChangeHandle){
										return;
									}
									if(newView && newView.id){
										dojo.publish("/davinci/scene/selectionChanged", [this, newView.id]);
									}
								}.bind(this));
							}
						}
					}
				}
			}
		},
		selectScene: function(params){
			var sceneId = params.sceneId;
			var dj = this.context.getDojo();
			var n;
			if(!dj){
				return;
			}
			var domNode = dj.byId(sceneId);
			var sceneSelected = null;
			if(this.context.declaredClass == 'davinci.ve.Context'){
				if(domNode){
					var widget = domNode._dvWidget;
					if(widget){
						var helper = widget.getHelper();
						if(helper && helper._updateVisibility){
							helper._updateVisibility(domNode);
							sceneSelected = sceneId;
						}
					}
				}
				var dj = this.context.select(widget);
			}else if(this.context.declaredClass == 'davinci.review.editor.Context'){
				var _dijit = dj.dijit;
				var node = domNode;
				var pnode = node.parentNode;
				var viewsToUpdate = [];
				// See if this View or any ancestor View is not currently visible
				while (node.tagName != 'BODY'){
					if(node.style.display == "none" || node.getAttribute("selected") != "true"){
						viewsToUpdate.splice(0, 0, node);
					}else{
						for(var i=0;i<pnode.children.length;i++){
							n=pnode.children[i];
							if(dj.hasClass(n,"mblView")){
								if(n!=node && (n.style.display != "none" || n.getAttribute("selected") == "true")){
									viewsToUpdate.splice(0, 0, node);
									break;
								}
							}
						}
					}
					node = pnode;
					pnode = node.parentNode;
				}
				for(var v=0;v<viewsToUpdate.length;v++){
					var viewNode = viewsToUpdate[v];
					if(viewNode && viewNode.id){
						var newView = _dijit.byId(viewNode.id);
						if(newView){
							if(newView.declaredClass == 'dojox.mobile.SwapView'){
								// For SwapView, we have to slide one-by-one from current SwapView
								// to the newly select SwapView
								var showingView = newView.getShowingView();
								var showingViewIndex, newViewIndex;
								var nodes = showingView.domNode.parentNode.childNodes;
								for(var j = 0; j < nodes.length; j++){
									n = nodes[j];
									if(n.id == showingView.id){
										showingViewIndex = j;
									}
									if(n.id == newView.id){
										newViewIndex = j;
									}
								}
								if(this._swapViewChangeHandle){
									// Extra careful to make sure there is only one listener
									dj.unsubscribe(this._swapViewChangeHandle);
									this._swapViewChangeHandle = null;
								}
								if(typeof showingViewIndex == 'number' && typeof newViewIndex == 'number' && showingViewIndex !== newViewIndex){
									var dir = (newViewIndex > showingViewIndex) ? 1 : -1;
									var cv = showingView;	// cv = current view
									this._swapViewChangeHandle = dj.subscribe("/dojox/mobile/viewChanged",function(v){
										if(v && v.id && v.id != newView.id && v.id != cv.id){
											cv = v;
											cv.goTo(dir);
										}else{
											dj.unsubscribe(this._swapViewChangeHandle);
											this._swapViewChangeHandle = null;
											dojo.publish("/davinci/scene/selectionChanged", [this, newView.id]);
										}
									}.bind(this));
									cv.goTo(dir);
								}
							}else if(newView.show){
								// for View and ScrollableView, call show()
								newView.show();
							}
						}
					}
				}
				sceneSelected = (viewsToUpdate.length>0) ? sceneId : null;
			}
			if(sceneSelected){
				dojo.publish("/davinci/scene/selectionChanged", [this, sceneSelected]);
			}
			return sceneSelected;
		},
		getCurrentScene: function(sceneContainerNode){
			var currentScene, viewDijit;
			var userDoc = this.context.getDocument();
			var _dijit = (userDoc && userDoc.defaultView && userDoc.defaultView.dijit);
/*FIXME: OLD LOGIC
			var refNode = userDoc;
			var searchForNested = true;
			while(searchForNested){
				var elems = refNode.querySelectorAll('.mblView');
*/
				var elems = sceneContainerNode.querySelectorAll('.mblView');
/*FIXME: OLD LOGIC
				if(elems.length === 0){
					break;
				}
				searchForNested = false;
*/
				for(var i=0; i<elems.length; i++){
					var elem = elems[i];
if(elem.parentNode != sceneContainerNode){
	continue;
}
					viewDijit = null;
					if(this.context.declaredClass == 'davinci.ve.Context'){
						viewDijit = (elem._dvWidget && elem._dvWidget.dijitWidget);
					}else if(this.context.declaredClass == 'davinci.review.editor.Context'){
						viewDijit = (_dijit && _dijit.byId && elem.id) ? _dijit.byId(elem.id) : null;
					}
					if(viewDijit && viewDijit.getShowingView){
						var showingView = viewDijit.getShowingView();
						if(showingView && showingView.domNode && showingView.domNode.id){
							currentScene = showingView.domNode;
/*
							currentScene = showingView.domNode.id;
							refNode = showingView.domNode;
							searchForNested = true;
*/
							break;
						}
					}
				}
/*FIXME: OLD LOGIC
			}
*/
			return currentScene;
		},
		getAllSceneContainers: function(){
			var allSceneContainers = [];
			if(!this.context || !this.context.rootNode){
				return allSceneContainers;
			}
			var dj = this.context.getDojo();
			if(!dj){
				return allSceneContainers;
			}
			var rootNode = this.context.rootNode;
			var allViews = dj.query('.mblView', rootNode);
			for(var i=0; i<allViews.length; i++){
				var view = allViews[i];
				var pn = view.parentNode;
				if(pn && allSceneContainers.indexOf(pn) < 0){
					allSceneContainers.push(pn);
				}
			}
			return allSceneContainers;
		},
		isSceneContainer: function(node){
			if(!this.context || !node){
				return false;
			}
			var dj = this.context.getDojo();
			if(!dj){
				return false;
			}
			for(var i=0; i<node.children.length; i++){
				var child = node.children[i];
				if(dj.hasClass(child, 'mblView')){
					return true;
				}
			}
			return false;
		},
		getSceneChildren: function(node){
			if(!this.context || !node){
				return [];
			}
			var dj = this.context.getDojo();
			if(!dj){
				return [];
			}
			var scenes = [];
			for(var i=0; i<node.children.length; i++){
				var child = node.children[i];
				if(dj.hasClass(child, 'mblView')){
					scenes.push(child);
				}
			}
			return scenes;
		},
		getSceneContainerForNode: function(node){
			if(!this.context || !node){
				return false;
			}
			return (node.tagName == 'BODY') ? null : node.parentNode;
		}
/*FIXME: REMOVE THIS
		,
		getAllScenes: function(){
			if(!this.context){
				return [];
			}
			var dj = this.context.getDojo();
			if(!dj){
				return [];
			}
			var scenes = [];
			var flattenedScenes = [];
			var views = dj.query('.mblView');
			for(var i=0; i<views.length; i++){
				var view = views[i];
				var o = { sceneId:view.id, name:view.id, type:this.category };
				if(dojo.hasClass(view.parentNode, 'mblView')){
					o.parentNodeId = view.parentNode.id;		// temporary property, removed below
				}
				scenes.push(o);
				flattenedScenes.push(o);
			}
			// The fetch operation above delivers a simple array of Views.
			// We need to return a data structure that reflects the hierarchy of Views,
			// so massage the scenes array so that nested Views are moved under the correct parent View.
			var idx = 0;
			while(idx < scenes.length){
				var scene = scenes[idx];
				parentNodeId = scene.parentNodeId;
				if(parentNodeId){
					delete scene.parentNodeId;	// remove temporary property
					var spliced = false;
					for(var j=0; j<flattenedScenes.length; j++){
						if(flattenedScenes[j].name === parentNodeId){
							if(!flattenedScenes[j].children){
								flattenedScenes[j].children = [];
							}
							scene.parentSceneId = flattenedScenes[j].sceneId;
							flattenedScenes[j].children.push(scene);
							scenes.splice(idx, 1);
							spliced = true;
							break;
						}
					}
					if(!spliced){
						console.error('could not find parentNodeId='+parentNodeId);
						idx++;
					}
				}else{
					idx++;
				}
			}
			return scenes;
		}
*/
/*FIXME: REMOVE THIS
 * 		,
 * 
		hideAppStates: function(){
			var context = this.context;
			if(!context){
				return false;
			}
			//hide application states if there are any mobile views and only the default Normal state
			if(context.declaredClass == 'davinci.ve.Context'){
				var dj = this.context.getDojo();
				if(!dj){
					return false;
				}
				var views = dj.query('.mblView');
				if(davinci.states && davinci.states.getStates){
					var states = davinci.states.getStates();
					return (views.length > 0 && states.length <= 1);
				}else{
					return false;
				}
			}else if(context.declaredClass == 'davinci.review.editor.Context'){
				var body = context.rootNode;
				var userWin = body && body.ownerDocument && body.ownerDocument.defaultView;
				var dj = userWin && userWin.dojo;
				var statesClass =  userWin && userWin.davinci && userWin.davinci.states;
				if(dj && statesClass && statesClass.getStates){
					var views = dj.query('.mblView');
					var states = statesClass.getStates();
					return (views.length > 0 && states.length <= 1);
				}else{
					return false;
				}
				
			}
		}
*/
	};

    return {
//        init: function(args) {
//        },
		onDocInit: function(context){
			var sm = new DojoMobileViewSceneManager(context);
			context.registerSceneManager(sm);
			dojo.subscribe('/davinci/ui/context/statesLoaded', function(docContext){
				sm._reviewEditorSceneChange(docContext);
			});
//		},
        
//        onFirstAdd: function(type, context) {
//        },
//        
//        onAdd: function(type, context) {
//        },
//        
//        onLastRemove: function(type, context) {
//        },
//        
//        onRemove: function(type, context) {
        }
    };

})();
