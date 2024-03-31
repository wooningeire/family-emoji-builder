const qs = (selector, context=document) => context.querySelector(selector);

// Emoji management "API" /////////////////////////////////////////////////////

/**
 * Zero-width joiner, used to combine people into families
 */
const ZWJ = "\u200d";

const LinkedList = (() => {
	class LinkedList {
		#firstNode = null;
		#lastNode = null;
		#length = 0;
		/**
		 * @type WeakMap<object, LinkedNode>
		 */
		#valueMap = new WeakMap();

		get first() {
			return this.#firstNode?.value;
		}

		get last() {
			return this.#lastNode?.value;
		}

		get length() {
			return this.#length;
		}

		get isEmpty() {
			return this.length === 0;
		}

		/**
		 * Updates the list's length and adds a value to the value map.
		 * @param {*} value 
		 * @param {LinkedNode} node 
		 * @returns {this}
		 */
		#record(value, node) {
			this.#length++;
			this.#valueMap.set(value, node);

			return this;
		}

		/**
		 * Updates the list's length and removes a value from the value map.
		 * @param {*} value 
		 * @returns {this}
		 */
		#unrecord(value) {
			this.#length--;
			this.#valueMap.delete(value);

			return this;
		}
	
		push(value) {
			if (this.includes(value)) {
				throw new Error("list already contains value");
			}

			const node = new LinkedNode(value);
	
			// Set the new node as the first if there is nothing else
			if (this.isEmpty) {
				this.#firstNode = node;
	
			// Set the new node as following the former last
			} else if (this.#lastNode) {
				this.#lastNode.next = node;
				node.prev = this.#lastNode;
			}
			// Set the new node as the last
			this.#lastNode = node;

			this.#record(value, node);
	
			return this;
		}

		unshift(value) {
			if (this.includes(value)) {
				throw new Error("list already contains value");
			}

			if (this.isEmpty) {
				this.push(value);

			} else {
				const node = new LinkedNode(value, null, this.#firstNode);
				this.#firstNode.prev = node;
				this.#firstNode = node;

				this.#record(value, node);
			}

			return this;
		}

		insertAfter(value, valueBefore=null) {
			if (this.includes(value)) {
				throw new Error("list already contains value");
			}

			// If falsy, unshift the value (`this.first` must be updated)
			if (!valueBefore) {
				this.unshift(value);
				return this;
			} 
			
			const nodeBefore = this.getNode(valueBefore);

			// Special case (`this.last` must be updated)
			if (nodeBefore === this.#lastNode) {
				this.push(value);

			// General insertion code
			} else {
				const nodeAfter = nodeBefore.next;

				const node = new LinkedNode(value, nodeBefore, nodeAfter);
				nodeBefore.next = node;
				nodeAfter.prev = node;

				this.#record(value, node);
			}
			
			return this;
		}

		pop() {
			const value = this.last;

			this.#lastNode = this.#lastNode.prev;
			if (this.#lastNode) {
				this.#lastNode.next = null;
			}

			this.#unrecord(value);

			return value;
		}

		shift() {
			const value = this.first;

			this.#firstNode = this.#firstNode.next;
			if (this.#firstNode) {
				this.#firstNode.prev = null;
			}

			this.#unrecord(value);

			return value;
		}

		remove(value) {
			const node = this.getNode(value);
			
			if (!node.prev) {
				this.shift();

			} else if (!node.next) {
				this.pop();

			} else {
				const nodeBefore = node.prev;
				const nodeAfter = node.next;
	
				nodeBefore.next = nodeAfter;
				nodeAfter.prev = nodeBefore;

				this.#unrecord(value);
			}
 
			return this;
		}
	
		join(separator=ZWJ) {
			return [...this].join(separator);
		}

		includes(value) {
			return this.#valueMap.has(value);
		}

		getNode(value) {
			return this.#valueMap.get(value);
		}
	
		* [Symbol.iterator]() {
			let currentNode = this.#firstNode;
	
			while (currentNode !== null) {
				yield currentNode.value;
				currentNode = currentNode.next;
			}
		}
	}
	
	class LinkedNode {
		value;

		prev;
		next;
	
		constructor(value, prev=null, next=null) {
			this.value = value;
			
			this.prev = prev;
			this.next = next;
		}
	}

	return LinkedList;
})();


/**
 * A single person in a family emoji.
 */
class Member extends EventTarget {
	/**
	 * Available member types in a family sequence.
	 * @enum
	 */
	static Type = class Type {
		char;
		isAdult;

		/**
		 * @enum
		 */
		static Adult = Object.freeze({
			PERSON: new Type("🧑", true),
			WOMAN: new Type("👩", true),
			MAN: new Type("👨", true),
		});
		
		/**
		 * @enum
		 */
		static Child = Object.freeze({
			CHILD: new Type("🧒", false),
			GIRL: new Type("👧", false),
			BOY: new Type("👦", false),
			BABY: new Type("👶", false),
		});

		constructor(char, isAdult) {
			this.char = char;
			this.isAdult = isAdult;

			Object.freeze(this);
		}

		toString() {
			return this.char;
		}
	};

	/**
	 * Available skin tone modifiers for family members.
	 * @enum
	 */
	static Tone = Object.freeze(["", "🏻", "🏼", "🏽", "🏾", "🏿"]);

	#type;
	#tone;

	constructor(type, tone=Member.Tone[0]) {
		super();

		this.#type = type;
		this.#tone = tone;
	}

	get type() {
		return this.#type;
	}

	set type(type) {
		this.#type = type;

		this.dispatchEvent(new Event("memberupdate"));
	}

	get tone() {
		return this.#tone;
	}

	set tone(tone) {
		this.#tone = tone;
		
		this.dispatchEvent(new Event("memberupdate"));
	}

	get isAdult() {
		return this.type.isAdult;
	}

	toString() {
		return this.type + this.tone;
	}

	get [Symbol.toStringTag]() {
		return this.constructor.name;
	}
}

const familySequence = {
	// Adults must come before children
	adults: new LinkedList(),
	children: new LinkedList(),

	get length() {
		return this.adults.length + this.children.length;
	},

	get firstMember() {
		if (this.children.isEmpty && this.adults.isEmpty) {
			return null;
		} else if (this.adults.isEmpty) {
			return this.children.first;
		} else {
			return this.adults.first;
		}
	},

	get lastMember() {
		if (this.children.isEmpty && this.adults.isEmpty) {
			return null;
		} else if (this.children.isEmpty) {
			return this.adults.last;
		} else {
			return this.children.last;
		}
	},

	memberAfter(member, wrap=true) {
		// If no member is provided, give the first member
		if (!member) {
			return this.firstMember;
		}

		// Get the current list and get the node found after
		const list = this.memberList(member.isAdult);

		const node = list.getNode(member);
		const nodeAfter = node.next;
		if (nodeAfter) {
			return nodeAfter.value;
		}
		// If there was no following node,
		if (!wrap) {
			return null;
		}
		
		// Take the other list and get its first element
		const listOther = this.memberList(!member.isAdult);
		if (!listOther.isEmpty) {
			return listOther.first;
		}
		// If the other list was empty,

		// Get the first item from the original list
		return list.first;
	},

	memberBefore(member, wrap=true) {
		// If no member is provided, give the last member
		if (!member) {
			return this.lastMember;
		}

		// Get the current list and get the node found before
		const list = this.memberList(member.isAdult);

		const node = list.getNode(member);
		const nodeBefore = node.prev;
		if (nodeBefore) {
			return nodeBefore.value;
		}
		// If there was no preceding node,
		if (!wrap) {
			return null;
		}
		
		// Take the other list and get its last element
		const listOther = this.memberList(!member.isAdult);
		if (!listOther.isEmpty) {
			return listOther.last;
		}
		// If the other list was empty,

		// Get the first item from the original list
		return list.last;
	},

	memberList(isAdult) {
		return isAdult ? this.adults : this.children;
	},

	validate() {
		const potentialErrors = {
			noAdults: this.adults.isEmpty,
			notEnoughMembers: this.length < 2,
			tooManyAdults: this.adults.length > 2,
			tooManyChildren: this.children.length > 2,
			mixedSkintone: false, // TODO
		};
	},

	toString() {
		let string = "";
		if (this.adults.length) {
			string += this.adults.join(ZWJ);
		}

		if (this.adults.length && this.children.length) {
			string += ZWJ;
		}

		if (this.children.length) {
			string += this.children.join(ZWJ);
		}
		return string;
	},
};

// DOM connections ////////////////////////////////////////////////////////////

// Precreated elements
const emojiPreview = qs("emoji-preview");
const emojiRows = {
	adults: qs(`emoji-row[name="adults"]`),
	children: qs(`emoji-row[name="children"]`),

	get(isAdult) {
		return isAdult ? emojiRows.adults : emojiRows.children;
	},
};

const memberSettingsContainer = qs(`member-settings-container`);
const memberSettings = qs(`member-settings`);
const outputBox = qs(`input[name="output"]`);

const copyButton = qs(`button[name="copy-button"]`);

// User actions
const selection = (() => {
	const selection = {
		value: null,
		replace(member) {
			unselect(this.value);
			this.value = member;
			select(this.value);

			return this;
		},
	};

	function unselect(member) {
		if (!member) return;

		MemberDisplay.memberMap.get(member).unselect();
	}

	function select(member) {
		memberSettingsContainer.classList.toggle("invisible", !member);

		if (!member) return;

		MemberDisplay.memberMap.get(member).select();

		while (memberSettings.lastElementChild) {
			memberSettings.lastElementChild.remove();
		}

		for (const settingsSection of Object.values(settingsSections)) {
			const hidden = !settingsApplicability.get(settingsSection).has(member.isAdult);
			// settingsSection.classList.toggle("hidden", hidden);

			if (!hidden) {
				memberSettings.append(settingsSection);
			}
		}

		const typeRadio = qs(`#${getRadioId(member.type)}`);
		const toneRadio = qs(`#${getRadioId(member.tone)}`);
		typeRadio.checked = true;
		toneRadio.checked = true;
	}

	return selection;
})();

/**
 * Actions that bundle several calls together, intended to be direct responses to user interaction
 */
const userActions = {
	addMember(member, memberReference, selectNew=true) {
		const list = familySequence.memberList(member.isAdult);
		const emojiRow = emojiRows.get(member.isAdult);

		list.insertAfter(member, memberReference);

		const memberDisplay = emojiRow.insertMemberDisplayAfter(member, memberReference);
		updateOutputBox();
		// updateChildrenRowShift();
	
		member.addEventListener("memberupdate", () => {
			// Update emoji preview and output box
			memberDisplay.updateContent();
			updateOutputBox();
			// updateChildrenRowShift();
		});
	
		if (selectNew) {
			selection.replace(member);
		}
	},

	removeMember(member) {
		familySequence.memberList(member.isAdult).remove(member);
	
		const emojiRow = emojiRows.get(member.isAdult);
		emojiRow.removeMemberDisplay(member);

		updateOutputBox();
		// updateChildrenRowShift();

		if (member === selection.value) {
			selection.replace();
		}
	},

	reinsertMember(member, memberReference=null) {
		const noPositionChange = memberReference === member || memberReference === familySequence.memberBefore(member, false);
		const rowIsUnshared = memberReference && member.isAdult !== memberReference.isAdult;
		if (noPositionChange || rowIsUnshared) return;

		userActions.removeMember(member);
		userActions.addMember(member, memberReference);
	},
};

function updateOutputBox() {
	outputBox.value = familySequence;
}

// function updateChildrenRowShift() {
	// Update the shift on the children emoji row
	// const classList = emojiRows.children.classList;

	// if (familySequence.children.length === 0 || familySequence.adults.length === 0) {
	// 	classList.remove("single-shift", "double-shift");
	// } else if (familySequence.children.length === 1 && familySequence.adults.length === 1) {
	// 	classList.add("single-shift");
	// 	classList.remove("double-shift");
	// } else {
	// 	classList.remove("single-shift");
	// 	classList.add("double-shift");
	// }
// }

// Initialize member settings

const settingsSections = Object.freeze({
	adultTypes: document.createElement("form"),
	childTypes: document.createElement("form"),
	tones: document.createElement("form"),
});

/**
 * @type Map<HTMLElement, Set<boolean>>
 */
const settingsApplicability = new Map([
	[settingsSections.adultTypes, new Set([true])],
	[settingsSections.childTypes, new Set([false])],
	[settingsSections.tones, new Set([true, false])],
]);


const memberDeleteButton = qs(`button[name="member-delete"]`);
memberDeleteButton.addEventListener("click", () => {
	userActions.removeMember(selection.value);
});

for (const settingsSection of Object.values(settingsSections)) {
	memberSettings.append(settingsSection);
}

const skinToneColors = {
	[Member.Tone[0]]: "#ffc83d",
	[Member.Tone[1]]: "#f7d7c4",
	[Member.Tone[2]]: "#d8b094",
	[Member.Tone[3]]: "#bb9167",
	[Member.Tone[4]]: "#8e562e",
	[Member.Tone[5]]: "#613d30",
};

function getRadioId(type) {
	return `radio-${type}`;
}

const buildMemberSettingsSection = (() => {
	const radioTypes = new Map();
	
	const onchanges = {
		type(event) {
			const radio = event.target;
			selection.value.type = radioTypes.get(radio);
		},

		tone(event) {
			const radio = event.target;
			selection.value.tone = radioTypes.get(radio);
		},
	};

	/**
	 * 
	 * @param {object} list 
	 * @param {HTMLFormElement} form 
	 * @param {string} radioName 
	 * @param {string} [rowProperty] `"type"` or `"tone"`
	 */
	return function buildMemberSettingsSection(list, form, radioName, rowProperty="type") {
		form.classList.add("hidden-radio");
		form.addEventListener("change", onchanges[rowProperty]);
	
		for (const option of Object.values(list)) {
			const radioId = getRadioId(option);
	
			const radio = document.createElement("input");
			radio.type = "radio";
			radio.id = radioId;
			radio.name = radioName;
			radioTypes.set(radio, option); // Can't use `value`, which only accepts strings
	
			const label = document.createElement("label");
			label.setAttribute("for", radioId);
			label.tabIndex = 0;

			if (rowProperty === "type") {
				label.textContent = option;
			} else if (rowProperty === "tone") {
				label.classList.add("skintone");
				label.style.background = skinToneColors[option];
			}
		
			form.append(radio, label);
		}
	};
})();

function isInputBox(element) {
	const tagName = element.tagName.toLowerCase();
	return (tagName === "input" && element.type === "text") || tagName === "textarea";
}

// Custom element classes

class MemberDisplay extends HTMLElement {
	/**
	 * @type WeakMap<Member, MemberDisplay>
	 */
	static memberMap = new WeakMap();
	static lastDraggedMemberDisplay = null;

	#member;
	
	constructor(member) {
		super();

		this.setMember(member);
		this.addEventListener("click", () => {
			selection.replace(this.member);
		});

		this.addEventListener("dragstart", event => {
			event.dataTransfer.dropEffect = "move";

			emojiRows.get(member.isAdult).classList.add("dragging");
			// this.updateContent(true);
			// this.classList.add("member-dragged");
			MemberDisplay.lastDraggedMemberDisplay = this;

		});
		this.addEventListener("dragend", event => {
			emojiRows.get(member.isAdult).classList.remove("dragging");
			// this.updateContent();
			// this.classList.remove("member-dragged");
			MemberDisplay.lastDraggedMemberDisplay = null;
		});

		this.tabIndex = 0;
		this.draggable = true;
	}

	connectedCallback() {
		this.title = "Edit this member";
	}

	get member() {
		return this.#member;
	}

	setMember(member) {
		MemberDisplay.memberMap.delete(this.member);
		MemberDisplay.memberMap.set(member, this);

		this.#member = member;
		this.updateContent();

		return this;
	}

	updateContent(empty=false) {
		this.textContent = empty ? "" : this.member;
		return this;
	}

	select() {
		this.classList.add("selected");
		this.scrollIntoView({behavior: "smooth"});
		return this;
	}

	unselect() {
		this.classList.remove("selected");
		return this;
	}

	// generateDragImage() {
	// 	const canvas = document.createElement("canvas");
	// 	const context = canvas.getContext("2d");
	// 	const computedStyle = getComputedStyle(this);

	// 	context.font = `${computedStyle.fontSize} sans-serif`;
	// 	const textMetrics = context.measureText(this.textContent);
	// 	canvas.width = textMetrics.actualBoundingBoxRight - textMetrics.actualBoundingBoxLeft;
	// 	canvas.height = textMetrics.actualBoundingBoxAscent - textMetrics.actualBoundingBoxDescent;

	// 	context.font = `${computedStyle.fontSize} sans-serif`;
	// 	context.textAlign = "center";
	// 	context.textBaseline = "top";
	// 	context.translate(canvas.width / 2, 0);
	// 	context.fillText(this.textContent, 0, 0, canvas.width);

	// 	return canvas;
	// }

	get isAdult() {
		return this.member.isAdult;
	}

	get associatedMemberBoundary() {
		return this.nextElementSibling;
	}
}

class MemberBoundary extends HTMLElement {
	// static memberMap = new WeakMap();

	// #member;
	member;

	constructor(member=null) {
		super();

		this.member = member;

		this.addEventListener("click", () => {
			if (this.isAdult) {
				userActions.addMember(new Member(Member.Type.Adult.PERSON, Member.Tone[0]), this.member);
			} else {
				userActions.addMember(new Member(Member.Type.Child.CHILD, Member.Tone[0]), this.member);
			}
		});

		this.addEventListener("dragover", event => {
			if (MemberDisplay.lastDraggedMemberDisplay.isAdult === this.isAdult) {
				event.preventDefault(); // Allow cursor change
			}
		});
		this.addEventListener("drop", event => {
			const memberDisplay = MemberDisplay.lastDraggedMemberDisplay;
			const member = memberDisplay.member;

			const memberReference = this.member;

			userActions.reinsertMember(member, memberReference);
		});

		this.tabIndex = 0;
	}

	connectedCallback() {
		this.title = this.tooltip;
	}

	get tooltip() {
		return `Insert new ${this.isAdult ? "adult" : "child"} here`;
	}

	// get member() {
	// 	return this.#member;
	// }

	// setMember(member=null) {
	// 	MemberBoundary.memberMap.delete(this.member);
	// 	if (member) {
	// 		MemberBoundary.memberMap.set(member, this);
	// 	}

	// 	this.#member = member;

	// 	return this;
	// }

	get isAdult() {
		return this.parentElement.isAdult;
	}

	get associatedMemberDisplay() {
		return MemberDisplay.memberMap.get(this.member);
	}
}

class EmojiRow extends HTMLElement {
	constructor() {
		super();
		
		this.append(new MemberBoundary());
	}

	insertMemberDisplayAfter(member, memberReference=null) {
		const memberDisplay = new MemberDisplay(member);
		const memberBoundary = new MemberBoundary(member);

		const referenceElement = memberReference
				? MemberDisplay.memberMap.get(memberReference).associatedMemberBoundary // `MemberBoundary` of the reference member
				: this.firstElementChild; // First `MemberBoundary` in the row

		referenceElement.insertAdjacentElement("afterend", memberDisplay);
		memberDisplay.insertAdjacentElement("afterend", memberBoundary);

		return memberDisplay;
	}

	removeMemberDisplay(member) {
		const memberDisplay = MemberDisplay.memberMap.get(member);
		const memberBoundary = memberDisplay.associatedMemberBoundary;

		memberDisplay.classList.add("shrink-out");
		memberBoundary.classList.add("shrink-out");
		memberDisplay.addEventListener("animationend", event => {
			if (event.animationName !== "shrink-out") return;

			memberDisplay.remove();
			memberBoundary.remove();
		}, {once: true});

		return this;
	}

	get isAdult() {
		return this.getAttribute("name") === "adults";
	}
}

function produceRandomFamily() {
	const nAdults = Math.floor(Math.random() * 2) + 1;

	const nChildren = nAdults === 1
			? Math.floor(Math.random() * 2) + 1
			: Math.floor(Math.random() * 3);

	const adultTypes = Object.values(Member.Type.Adult);
	const childTypes = Object.values(Member.Type.Child);
	const tones = Object.values(Member.Tone);

	for (let i = 0; i < nAdults; i++) {
		const typeIndex = Math.floor(Math.random() * adultTypes.length);
		const toneIndex = Math.floor(Math.random() * tones.length);
		userActions.addMember(new Member(adultTypes[typeIndex], tones[toneIndex]), null, false);
	}

	for (let i = 0; i < nChildren; i++) {
		const typeIndex = Math.floor(Math.random() * childTypes.length);
		const toneIndex = Math.floor(Math.random() * tones.length);
		userActions.addMember(new Member(childTypes[typeIndex], tones[toneIndex]), null, false);
	}
}

// DOM init ///////////////////////////////////////////////////////////////////

buildMemberSettingsSection(Member.Type.Adult, settingsSections.adultTypes, "adult-type", "type");
buildMemberSettingsSection(Member.Type.Child, settingsSections.childTypes, "child-type", "type");
buildMemberSettingsSection(Member.Tone, settingsSections.tones, "skintone", "tone");

customElements.define("member-boundary", MemberBoundary);
customElements.define("member-display", MemberDisplay);
customElements.define("emoji-row", EmojiRow);

outputBox.addEventListener("input", () => {
	updateOutputBox();
});

{
	const successFlashHandler = () => {
		outputBox.classList.remove("success");
	};
	copyButton.addEventListener("click", async () => {
		// Permission check not available on Firefox
		// const permission = await navigator.permissions.query({name: "clipboard-write"});
		// if (permission.state === "denied") return;

		try {
			await navigator.clipboard.writeText(outputBox.value);

			// Flash green on success
			outputBox.classList.remove("success");
			outputBox.removeEventListener("animationend", successFlashHandler, {once: true});
			void outputBox.offsetHeight; // Force reflow to ensure animation restarts properly
			outputBox.classList.add("success");
			outputBox.addEventListener("animationend", successFlashHandler, {once: true});
		} catch (error) {
		}
	});
}

emojiPreview.addEventListener("click", event => {
	if (event.target !== event.currentTarget) return;
	selection.replace();
});

produceRandomFamily();

addEventListener("keydown", event => {
	if (isInputBox(document.activeElement)) return;

	const crossCase = {};

	switch (event.key) {
		case "Delete":
			if (!selection.value) break;
			userActions.removeMember(selection.value);

			break;

		case "Backspace": {
			if (!selection.value) break;
			const memberCurrent = selection.value;
			selection.replace(familySequence.memberBefore(selection.value));
			userActions.removeMember(memberCurrent);
			break;
		}

		case "ArrowLeft":
			// Do not scroll if a member is selected
			if (selection.value) {
				event.preventDefault();
			}
			selection.replace(familySequence.memberBefore(selection.value));
			break;
		
		case "ArrowRight":
			// Do not scroll if a member is selected
			if (selection.value) {
				event.preventDefault();
			}
			selection.replace(familySequence.memberAfter(selection.value));
			break;

		case "ArrowUp":
			crossCase.isAdult = true;
		// bleed
		case "ArrowDown":
			if (!crossCase.isAdult) {
				crossCase.isAdult = false;
			}

			if (selection.value) {
				event.preventDefault();
				selection.replace(familySequence.memberList(!selection.value.isAdult).first);
			} else {
				selection.replace(familySequence.memberList(crossCase.isAdult).first);
			}
			break;

		case "Home":
			selection.replace(familySequence.firstMember);
			break;
		
		case "End":
			selection.replace(familySequence.lastMember);
			break;

		case "Enter":
			document.activeElement?.click();
			break;
	}
});